package com.mcevoy.syncrecordapp

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Bundle
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import org.json.JSONObject
import android.util.Log
import android.widget.Toast
import androidx.core.app.ActivityCompat
import androidx.core.view.isVisible
import java.time.Instant

//Request device microphone
const val REQUEST_CODE = 200
class MainActivity : AppCompatActivity(), SocketManagerCallback {
    private lateinit var socketManager: SocketManager
    private lateinit var debugText: TextView
    private lateinit var roomText: TextView
    private lateinit var deviceText: TextView
    // Variables for audio recording
    private var permissions = arrayOf(Manifest.permission.RECORD_AUDIO)
    private var permissionGranted = false
    private var isRecording = false
    private lateinit var audioRecord: AudioRecord
    private lateinit var recordingThread: Thread
    // Variables for master device
    private var master = false
    private lateinit var arrayToken: String
    private var connectedDevices: MutableList<String> = mutableListOf()
    private lateinit var ed: String
    private lateinit var recordingDevices: Array<Int?>
    private lateinit var stoppedDevices: Array<Int?>

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_main)
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }
        //Check if access to unprocessed audio data is available on device
        checkUnprocessedAudioSupport()
        // Get permissions to access the device microphone
        permissionGranted = ActivityCompat.checkSelfPermission(this, permissions[0]) == PackageManager.PERMISSION_GRANTED
        if(!permissionGranted)
            ActivityCompat.requestPermissions(this, permissions, REQUEST_CODE)

        //socketManager = SocketManager("https://192.168.1.6:8443",this)
        socketManager = SocketManager("https://syncrecord.eu:8443",this)
        // Interface
        val btnJoin: Button = findViewById(R.id.joinButton)
        val inputID: EditText = findViewById(R.id.IDInput)
        val btnCreate: Button = findViewById(R.id.createButton)
        val btnRecord: Button = findViewById(R.id.recordButton)
        val btnStop: Button = findViewById(R.id.stopButton)
        debugText = findViewById(R.id.textView)
        roomText = findViewById(R.id.textViewRoom)
        deviceText = findViewById(R.id.textViewDevNum)

        inputID.setOnEditorActionListener{v, actionId, event ->
            if (actionId == EditorInfo.IME_ACTION_DONE){
                btnJoin.performClick()
                true
            }
            else {
                false
            }
        }
        btnJoin.setOnClickListener {
            // Check Array ID is valid
            //inputID.setText("Button Clicked")
            // Join array through sockets.
            //println("Button Pressed")
            if (inputID.text.toString().trim().isNotEmpty()) {
                //debugText.setText(inputID.text.toString())
                roomText.text = inputID.text.toString()
                socketManager.sendJoinRoom(inputID.text.toString().trim())
                btnCreate.isEnabled = false
            } else {
                //Notification to user
            }
        }
        btnCreate.setOnClickListener {
            // TODO: Create Array sequence
            arrayToken = generateRandomCode(4)
            master = true
            roomText.text = arrayToken
            socketManager.sendJoinRoom(arrayToken)
            btnJoin.isEnabled = false
            btnRecord.isVisible = true
            btnStop.isVisible = true
        }
        btnRecord.setOnClickListener {
            //debugText.setText("Record Button Pressed")
            recordingDevices = arrayOfNulls(connectedDevices.size)
            stoppedDevices = arrayOfNulls(connectedDevices.size)
            ed = Instant.now().toEpochMilli().toString()
            val data = JSONObject()
            data.put("command","Start")
            data.put("timedate",ed)
            data.put("numDevices",connectedDevices.size.toString())
            data.put("room",arrayToken)
            data.put("master",socketManager.socket.id().toString())
            socketManager.sendDistanceRecord(data)
        }
        btnStop.setOnClickListener {
            debugText.setText("Stop Button Pressed")
            val data = JSONObject()
            data.put("command","Stop")
            data.put("room",arrayToken)
            data.put("timedate",ed)
            data.put("master",socketManager.socket.id().toString())
            socketManager.sendDistanceRecord(data)
        }
    }
    override fun onDevNumAssigned(devNum: String) {
        //TODO("Not yet implemented -> Add UI component")
        //debugText.text = devNum.toString()
        deviceText.text = devNum.toString()
        //var test = devNum
    }
    override fun onNumberOfDevices(number: String) {
        // Number of devices needed??
        var num = number
    }
    override fun onReceivedDistanceRecord(data: JSONObject) {
        val timedate = data.getString("timedate")
        val command = data.getString("command")
        val room = data.getString("room")
        val datamaster = data.getString("master")
        if(command == "Start") {
            //Start recording
            debugText.setText("Start Recieved")
            // Start recording audio
            startRecording(timedate,room,datamaster)
        }
        else if(command == "Stop") {
            debugText.setText("Stop Recieved")
            stopRecording(timedate,room,datamaster)
        }
        else if(command == "Started" && master) {
            debugText.setText("Received Started from device")
            val device = data.getString("device")
            val devInArray = data.getString("devinarray")
            recordingDevices[devInArray.toInt()-1] = 1
            val allRecording = recordingDevices.all { it == 1 }
            if(recordingDevices.size == connectedDevices.size && allRecording) {
                //Start the PRBS sequences
                val sendData = JSONObject()
                sendData.put("timedate",timedate)
                sendData.put("command","PRBSPlay")
                sendData.put("device",connectedDevices[0].toString())
                sendData.put("room",room)
                sendData.put("master",datamaster)
                socketManager.sendDistanceRecord(sendData)
            }
        }
        else if(command == "Stopped" && master) {
            debugText.setText("Received Started from device")
            val device = data.getString("device")
            val devInArray = data.getString("devinarray")
            stoppedDevices[devInArray.toInt()-1] = 1
            val allStopped = stoppedDevices.all { it == 1 }
            if(stoppedDevices.size == connectedDevices.size && allStopped) {
                val sendData = JSONObject()
                sendData.put("timedate",timedate)
                sendData.put("command","SyncAudio")
                sendData.put("devices",connectedDevices.size)
                sendData.put("room",room)
                sendData.put("master",datamaster)
                socketManager.sendDistanceRecord(sendData)
            }
        }
    }
    override fun onReceivedJoinedRoom(data: JSONObject) {
        debugText.setText("Joined Room Recieved")
        if(master) {
            val id = data.getString("id")
            connectedDevices.add(id)
            val numDevices = connectedDevices.size
            val sendData = JSONObject()
            sendData.put("device",numDevices)
            sendData.put("id",id)
            sendData.put("room",arrayToken)
            val array: Array<String> = connectedDevices.toTypedArray()
            val sendData1 = JSONObject()
            sendData1.put("ids",array)
            sendData1.put("room",arrayToken)
            socketManager.sendAssignDevice(sendData)
            socketManager.sendDeviceIds(sendData1)
        } else {
            //Error handling.
        }
    }

    // Recording functions
    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ){
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if(requestCode == REQUEST_CODE)
            permissionGranted = grantResults[0] == PackageManager.PERMISSION_GRANTED
    }
    private fun checkUnprocessedAudioSupport(){
        val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val isUnprocessedAudioSupported = audioManager.getProperty(AudioManager.PROPERTY_SUPPORT_AUDIO_SOURCE_UNPROCESSED)

        if (isUnprocessedAudioSupported != null && isUnprocessedAudioSupported == "true") {
            //Toast.makeText(this, "Unprocessed audio source is supported.", Toast.LENGTH_LONG).show()
        } else {
            Toast.makeText(this, "Unprocessed audio source is not supported on this device. Results might be inaccurate", Toast.LENGTH_LONG).show()
        }
    }
    // Handle audio recording. A new thread grabs and forwards audio to server
    private fun startRecording(timedate: String, room: String, master: String){
        if(!permissionGranted){
            ActivityCompat.requestPermissions(this, permissions, REQUEST_CODE)
            return
        }
        // Start recording audio
        // AudioRecord has more control compared to MediaRecord
        val sampleRate = 48000
        val channelConfig = AudioFormat.CHANNEL_IN_MONO
        val audioFormat = AudioFormat.ENCODING_PCM_16BIT //16bit int for older devices
        //val audioFormat = AudioFormat.ENCODING_PCM_FLOAT // 32Bit float supported on older devices?
        val bufferSize = AudioRecord.getMinBufferSize(sampleRate,channelConfig,audioFormat)

        if (ActivityCompat.checkSelfPermission(
                this,
                Manifest.permission.RECORD_AUDIO
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            // TODO: Consider calling
            //    ActivityCompat#requestPermissions
            // here to request the missing permissions, and then overriding
            //   public void onRequestPermissionsResult(int requestCode, String[] permissions,
            //                                          int[] grantResults)
            // to handle the case where the user grants the permission. See the documentation
            // for ActivityCompat#requestPermissions for more details.
            return
        }
        audioRecord = AudioRecord(
            MediaRecorder.AudioSource.MIC,
            sampleRate,
            channelConfig,
            audioFormat,
            bufferSize
        )

        audioRecord.startRecording()
        isRecording = true

        recordingThread = Thread{
            //writeAudioDataToFile(bufferSize)
            val buffer = ByteArray(bufferSize)
            while (isRecording) {
                val read = audioRecord.read(buffer,0,buffer.size)
                if(read > 0) {
                    sendAudioData(buffer,timedate,room)
                }
            }
        }
        recordingThread.start()

        val data = JSONObject()
        data.put("command","Started")
        data.put("timedate",timedate)
        data.put("devinarray",deviceText.text.toString())
        data.put("room",room)
        data.put("master",master)
        socketManager.sendDistanceRecord(data)
    }
    private fun stopRecording(timedate: String, room: String, master: String){
        if(isRecording){
            isRecording = false
            audioRecord.stop()
            audioRecord.release()
        }
        val data = JSONObject()
        data.put("command","Stopped")
        data.put("timedate",timedate)
        data.put("devinarray",deviceText.text.toString())
        data.put("room",room)
        data.put("master",master)
        socketManager.sendDistanceRecord(data)
    }
    private fun sendAudioData(buffer: ByteArray,timedate: String,room: String){
        val data = JSONObject()
        data.put("audioData",buffer)
        data.put("timedate",timedate.toString())
        data.put("room",room.toString())
        data.put("device",deviceText.text.toString())
        //data.put("samples",buffer.size)
        //data.put("totsamples",totalsamples)
        socketManager.sendAudio(data)
    }
    fun generateRandomCode(length: Int = 4): String {
        val chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz0123456789"
        return (1..length)
            .map { chars.random() }
            .joinToString("")
    }

}

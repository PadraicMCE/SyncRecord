package com.mcevoy.syncrecordapp
//TODO: Disable buttons when socket connection with host is lost.
import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Resources
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.MediaRecorder
import android.media.AudioTrack
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
import android.widget.Toast
import androidx.core.app.ActivityCompat
import androidx.core.view.isVisible
import java.time.Instant
import android.media.MediaPlayer
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore.Audio
import android.util.Log
import android.view.Menu
import android.view.MenuInflater
import android.view.MenuItem
import android.view.WindowManager
import android.widget.ImageButton
import android.widget.PopupMenu
import androidx.appcompat.app.AlertDialog
//import androidx.privacysandbox.tools.core.generator.build
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

//Request device microphone
const val REQUEST_CODE = 200
class MainActivity : AppCompatActivity(), SocketManagerCallback, SettingsDialogFragment.OnInputListener {
    private lateinit var socketManager: SocketManager
    private lateinit var debugText: TextView
    private lateinit var roomText: TextView
    private lateinit var deviceText: TextView
    private lateinit var roomTextStatic: TextView
    private lateinit var devNumStatic: TextView
    // Variables for audio recording
    private var permissions = arrayOf(Manifest.permission.RECORD_AUDIO)
    private var permissionGranted = false
    private var isRecording = false
    private lateinit var audioRecord: AudioRecord
    private lateinit var recordingThread: Thread
    // Playing audio
    private lateinit var mediaPlayer: MediaPlayer
    private lateinit var readyDevices: Array<Int?>
    //private val readyDevices: MutableList<Int?> = mutableListOf()
    // Variables for master device
    private var master = false
    private lateinit var arrayToken: String
    private var connectedDevices: MutableList<String> = mutableListOf()
    private lateinit var ed: String
    private lateinit var recordingDevices: Array<Int?>
    private lateinit var stoppedDevices: Array<Int?>
    private var socketAddress: String = "https://syncrecord.eu:8443"
    //private var socketAddress: String = "https://192.168.1.1:8443"
    //buttons
    private lateinit var btnJoin: Button
    private lateinit var btnCreate: Button
    private lateinit var btnRecord: Button
    private lateinit var btnStop: Button
    private lateinit var btnCalibrate: Button
    // Download audio files
    private lateinit var downloadFilesRecyclerView: RecyclerView
    private lateinit var downloadFilesAdapter: DownloadFilesAdapter
    private val downloadItems = mutableListOf<DownloadItem>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_main)
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }
        // Keep the screen on
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        //Check if access to unprocessed audio data is available on device
        checkUnprocessedAudioSupport()
        // Get permissions to access the device microphone
        permissionGranted = ActivityCompat.checkSelfPermission(this, permissions[0]) == PackageManager.PERMISSION_GRANTED
        if(!permissionGranted)
            ActivityCompat.requestPermissions(this, permissions, REQUEST_CODE)

        // Interface
        btnJoin = findViewById(R.id.joinButton)
        //val inputID: EditText = findViewById(R.id.IDInput)
        btnCreate = findViewById(R.id.createButton)
        btnRecord = findViewById(R.id.recordButton)
        btnStop = findViewById(R.id.stopButton)
        btnCalibrate = findViewById(R.id.calibrateButton)
        debugText = findViewById(R.id.textView)
        roomText = findViewById(R.id.textViewRoom)
        deviceText = findViewById(R.id.textViewDevNum)
        roomTextStatic = findViewById(R.id.textViewRoomStatic)
        devNumStatic = findViewById(R.id.textViewDevNumStatic)

        socketManager = SocketManager(socketAddress,this)

        /*
        inputID.setOnEditorActionListener{v, actionId, event ->
            if (actionId == EditorInfo.IME_ACTION_DONE){
                btnJoin.performClick()
                true
            }
            else {
                false
            }
        }*/
        btnJoin.setOnClickListener {
            // Popup window to enter array unique ID.
            showInputDialog();
            roomTextStatic.isVisible = true
            devNumStatic.isVisible = true
            // Check Array ID is valid
            //inputID.setText("Button Clicked")
            // Join array through sockets.
            //println("Button Pressed")
            /*
            if (inputID.text.toString().trim().isNotEmpty()) {
                //debugText.setText(inputID.text.toString())
                roomText.text = inputID.text.toString()
                socketManager.sendJoinRoom(inputID.text.toString().trim())
                btnCreate.isEnabled = false
            } else {
                //Notification to user
            }*/
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
            btnCalibrate.isVisible = true
            roomTextStatic.isVisible = true
            devNumStatic.isVisible = true
        }
        btnRecord.setOnClickListener {
            //debugText.setText("Record Button Pressed")
            recordingDevices = arrayOfNulls(connectedDevices.size)
            stoppedDevices = arrayOfNulls(connectedDevices.size)
            readyDevices = arrayOfNulls(connectedDevices.size)
            ed = Instant.now().toEpochMilli().toString()
            val data = JSONObject()
            data.put("command","Start")
            data.put("timedate",ed)
            data.put("numDevices",connectedDevices.size.toString())
            data.put("room",arrayToken)
            data.put("master",socketManager.socket.id().toString())
            data.put("calibrating",false)
            socketManager.sendDistanceRecord(data)
        }
        btnStop.setOnClickListener {
            //debugText.setText("Stop Button Pressed")
            val data = JSONObject()
            data.put("command","Stop")
            data.put("room",arrayToken)
            data.put("timedate",ed)
            data.put("master",socketManager.socket.id().toString())
            socketManager.sendDistanceRecord(data)
        }
        btnCalibrate.setOnClickListener {
            recordingDevices = arrayOfNulls(connectedDevices.size)
            stoppedDevices = arrayOfNulls(connectedDevices.size)
            readyDevices = arrayOfNulls(connectedDevices.size)
            ed = Instant.now().toEpochMilli().toString()
            val data = JSONObject()
            data.put("command","Start")
            data.put("timedate",ed)
            data.put("numDevices",connectedDevices.size.toString())
            data.put("room",arrayToken)
            data.put("master",socketManager.socket.id().toString())
            data.put("calibrating",true)
            socketManager.sendDistanceRecord(data)
        }
        val buttonOpenMenu: ImageButton = findViewById(R.id.button_open_menu)
        buttonOpenMenu.setOnClickListener {
            showPopupMenu(it)
        }

        //Download audio files list
        //setContentView(R.layout.activity_downloads)
        //downloadFilesRecyclerView = findViewById(R.id.downloadFilesRecyclerView)
        //downloadFilesRecyclerView.layoutManager = LinearLayoutManager(this)
        //downloadFilesAdapter = DownloadFilesAdapter(downloadItems)
        //downloadFilesRecyclerView.adapter = downloadFilesAdapter
    }
    override fun onDevNumAssigned(devNum: String) {
        //TODO("Not yet implemented -> Add UI component")
        //debugText.text = devNum.toString()
        runOnUiThread {
            deviceText.text = devNum.toString()
        }
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
            /*
            runOnUiThread {
                debugText.text = "Start Received"
            }
            */
            // Start recording audio
            val calibrating = data.getBoolean("calibrating")
            startRecording(timedate,room,datamaster,calibrating)
        }
        else if(command == "Stop") {
            /*
            runOnUiThread {
                debugText.text = "Stop Received"
            }
            */
            val calibrating = data.getBoolean("calibrating")
            stopRecording(timedate,room,datamaster,calibrating)
        }
        else if(command == "Started" && master) {
            /*
            runOnUiThread {
                debugText.text = "Received Started from device"
            }
            */
            val device = data.getString("device")
            val devInArray = data.getString("devinarray")
            val calibrating = data.getBoolean("calibrating")
            recordingDevices[devInArray.toInt()-1] = 1
            val allRecording = recordingDevices.all { it == 1 }
            if(recordingDevices.size == connectedDevices.size && allRecording) {
                if(calibrating){
                    //Start the PRBS sequences
                    val sendData = JSONObject()
                    sendData.put("timedate",timedate)
                    sendData.put("command","PRBSPlay")
                    sendData.put("device",connectedDevices[0].toString())
                    sendData.put("room",room)
                    sendData.put("master",datamaster)
                    sendData.put("calibrating",true)
                    socketManager.sendDistanceRecord(sendData)
                }
            }
        }
        else if(command == "Stopped" && master) {
            /*
            runOnUiThread {
                debugText.text = "Received Started from device"
            }
            */
            //val device = data.getString("device")
            val devInArray = data.getString("devinarray")
            val calibrating = data.getBoolean("calibrating")

            stoppedDevices[devInArray.toInt()-1] = 1
            val allStopped = stoppedDevices.all { it == 1 }
            if(stoppedDevices.size == connectedDevices.size && allStopped) {
                if(calibrating){
                    val sendData = JSONObject()
                    sendData.put("timedate",timedate)
                    sendData.put("command","Sync")
                    sendData.put("room",room)
                    sendData.put("master",datamaster)
                    sendData.put("calibrating",true)
                    // Send message after 1 second
                    val handler = Handler(Looper.getMainLooper())
                    handler.postDelayed({
                        socketManager.sendDistanceRecord(sendData)
                    }, 1000)
                }
                val sendData = JSONObject()
                sendData.put("timedate",timedate)
                sendData.put("command","SyncAudio")
                sendData.put("devices",connectedDevices.size)
                sendData.put("room",room)
                sendData.put("master",datamaster)
                sendData.put("calibrating",calibrating)
                socketManager.sendDistanceRecord(sendData)
            }
        }
        else if(command == "PRBSPlay") {
            /*
            runOnUiThread {
                Toast.makeText(
                    this,
                    "Received PRBS Play",
                    Toast.LENGTH_LONG
                ).show()
            }
            */
            //mediaPlayer = MediaPlayer.create(this, R.raw.prbs1_seq_100)
            //mediaPlayer.start()
            //mediaPlayer.setOnCompletionListener {
            playBinaryAudio {
                // Tell master this device has finished playing the PRBS
                //val devinarray = data.get("devinarray")
                val calibrating = data.getBoolean("calibrating")
                val sendData = JSONObject()
                sendData.put("timedate",timedate)
                sendData.put("command","PRBSFinished")
                sendData.put("room",room)
                sendData.put("master",datamaster)
                sendData.put("deviceNo",deviceText.text)
                sendData.put("devinarray",deviceText.text)
                sendData.put("calibrating",calibrating)
                // Send message
                socketManager.sendDistanceRecord(sendData)
            }
        }
        else if(command == "PRBSFinished" && master) {
            val devInArray = data.getString("devinarray")
            val calibrating = data.getBoolean("calibrating")
            // If all devices are not finished -> Send play command to next device
            readyDevices[devInArray.toInt()-1] = 1
            val allFinished = readyDevices.all { it == 1 }
            if(readyDevices.size == connectedDevices.size && allFinished) {
                // All devices finished playing PRBS
                /*
                runOnUiThread {
                    Toast.makeText(
                        this,
                        "Received PRBS finished from Device $devInArray All devices ready: $allFinished",
                        Toast.LENGTH_LONG
                    ).show()
                }*/
                // Run Python script to determine time lags
                val sendData = JSONObject()
                sendData.put("timedate",timedate)
                //sendData.put("command","Sync")
                sendData.put("command","Stop")
                sendData.put("room",room)
                sendData.put("master",datamaster)
                sendData.put("calibrating",calibrating)
                // Send message after 1 second
                val handler = Handler(Looper.getMainLooper())
                handler.postDelayed({
                    socketManager.sendDistanceRecord(sendData)
                }, 1000)
            }
            else {
                // All devices not finished -> Send play command to the next device
                val sendData = JSONObject()
                sendData.put("timedate",timedate)
                sendData.put("command","PRBSPlay")
                sendData.put("device",connectedDevices[devInArray.toInt()])
                sendData.put("room",room)
                sendData.put("master",datamaster)
                sendData.put("calibrating",calibrating)
                // Send message
                val handler = Handler(Looper.getMainLooper())
                handler.postDelayed({
                    socketManager.sendDistanceRecord(sendData)
                }, 500)
                /*
                runOnUiThread {
                    Toast.makeText(
                        this,
                        "Sent PRBS play to Device ${devInArray.toInt()+1}",
                        Toast.LENGTH_LONG
                    ).show()
                }
                */
            }
        }

    }
    override fun onReceivedJoinedRoom(data: JSONObject) {
        /*
        runOnUiThread {
            debugText.setText("Joined Room Recieved")
        }
        */
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

    //Options menu
    private fun showPopupMenu(view: android.view.View) {
        val popup = PopupMenu(this, view)
        val inflater: MenuInflater = popup.menuInflater
        inflater.inflate(R.menu.options_menu, popup.menu)
        popup.setOnMenuItemClickListener { item: MenuItem ->
            when (item.itemId) {
                R.id.action_socket_address -> {
                    // Handle settings click
                    val dialog = SettingsDialogFragment()
                    dialog.show(supportFragmentManager, "SettingsDialog")
                    true
                }
                R.id.action_view_downloads -> {
                    // Open the DownloadsActivity when the menu item is clicked
                    val intent = Intent(this, DownloadsActivity::class.java)
                    startActivity(intent)
                    true
                }
                else -> false
            }
        }
        popup.show()
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
            Toast.makeText(this, "Unprocessed audio source is supported.", Toast.LENGTH_LONG).show()
        } else {
            Toast.makeText(this, "Unprocessed audio source is not supported on this device. Results might be inaccurate", Toast.LENGTH_LONG).show()
        }
    }
    // Handle audio recording. A new thread grabs and forwards audio to server
    private fun startRecording(timedate: String, room: String, master: String, calibrating: Boolean){
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
            MediaRecorder.AudioSource.UNPROCESSED,
            //MediaRecorder.AudioSource.MIC,
            sampleRate,
            channelConfig,
            audioFormat,
            bufferSize
        )

        //Check if audioRecord is initialized with the correct sampling rate.
        if (audioRecord.state != AudioRecord.STATE_INITIALIZED) {
            // Add error handling.
            /*
            runOnUiThread {
                debugText.setText("Sampling rate not set")
            }
            */
            return;
        }
        var totalData = 0L
        audioRecord.startRecording()
        isRecording = true

        recordingThread = Thread{
            //writeAudioDataToFile(bufferSize)
            val buffer = ByteArray(bufferSize)

            while (isRecording) {
                // TODO: Additional error handling here.
                val read = audioRecord.read(buffer,0,buffer.size)
                if(read > 0) {
                    totalData += buffer.size.toLong()
                    sendAudioData(buffer,timedate,room,totalData)
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
        data.put("device",socketManager.socket.id().toString())
        data.put("calibrating",calibrating)
        socketManager.sendDistanceRecord(data)
    }
    private fun stopRecording(timedate: String, room: String, master: String, calibrating: Boolean){
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
        data.put("calibrating",calibrating)
        socketManager.sendDistanceRecord(data)
    }
    private fun sendAudioData(buffer: ByteArray,timedate: String,room: String, totaldata: Long){
        val data = JSONObject()
        data.put("audioData",buffer)
        data.put("timedate",timedate.toString())
        data.put("room",room.toString())
        data.put("device",deviceText.text.toString())
        data.put("totData",totaldata)
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

    override fun setButtonsActive() {
        runOnUiThread {
            btnJoin.isVisible = true
            btnCreate.isVisible = true
        }
    }

    override fun connectionErrorMessage(message: String)
    {
        runOnUiThread {
            debugText.text = message
        }
    }

    //TODO: Fix the socket address error text showing after correct connection
    override fun sendInput(input: String) {
        // Set the received input to a variable
        socketAddress = input
        socketManager = SocketManager(socketAddress,this)
        //Toast.makeText(this, input, Toast.LENGTH_LONG).show()
        //Log.d("MainActivity", "Received input from dialog: $receivedInput")
    }

    // Downloading audio files from server
    private fun addNewDownloadLink(fileName: String, downloadLink: String) {
        val newItem = DownloadItem(fileName, downloadLink)
        downloadFilesAdapter.addDownloadItem(newItem)
    }

    // Socket.IO code to handle receiving new download links
    private fun onDownloadLinkReceived(fileName: String, downloadLink: String) {
        runOnUiThread {
            addNewDownloadLink(fileName, downloadLink)
        }
    }

    private fun playBinaryAudio(onCompletion: () -> Unit) {
        val sampleRate = 48000;
        val channelConfig = AudioFormat.CHANNEL_OUT_MONO;
        val audioFormat = AudioFormat.ENCODING_PCM_16BIT;
        try {
            val inputStream = resources.openRawResource(R.raw.prbs1_3_delta)
            val audioData = inputStream.readBytes()
            inputStream.close()
            //Calculate minimum buffer size
            val buffersize = audioData.size //* 2
            //val buffersize = AudioTrack.getMinBufferSize(sampleRate, channelConfig, audioFormat)
            /*
            runOnUiThread {
                debugText.text = "Buffer size: " + buffersize.toString() + "  Audio data: " + audioData.size.toString()
            }
            */
            //Create and configure AudioTrack
            val audioTrack = AudioTrack.Builder()
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_UNKNOWN)
                        .build()
                )
                .setAudioFormat(AudioFormat.Builder()
                    .setEncoding(audioFormat)
                    .setSampleRate(sampleRate)
                    .setChannelMask(channelConfig)
                    .build())
                .setBufferSizeInBytes(buffersize)
                .setTransferMode(AudioTrack.MODE_STATIC)
                .build()
            //Write audio data to the AudioTrack
            audioTrack.write(audioData,0,audioData.size)
            //Set up listener to trigger a command when playback finished
            //audioTrack.setNotificationMarkerPosition(audioData.size / (16 / 8))
            //TODO: Change
            audioTrack.setNotificationMarkerPosition(765)
            audioTrack.setPlaybackPositionUpdateListener(object : AudioTrack.OnPlaybackPositionUpdateListener {
                override fun onMarkerReached(track: AudioTrack?) {
                    // Run onCompletion() command
                    onCompletion()
                }

                override fun onPeriodicNotification(track: AudioTrack?) {
                    // Optional: monitor playback periodically (if needed)
                }
            })

            /*
            audioTrack.setPlaybackPositionUpdateListener(object : AudioTrack.OnPlaybackPositionUpdateListener {
                override fun onMarkerReached(track: AudioTrack?) {
                    //Run onCompletion() command
                    onCompletion()
                }
                override fun onPeriodicNotification(track: AudioTrack?) {
                    //Needed?
                }
            })
            */
            //Set the volume 0.0 = min; 1.0 = max
            audioTrack.setVolume(1.0f)
            //Play the audio
            audioTrack.play()
            //val durationInSeconds = audioData.size / (sampleRate * 2.0) // In seconds, assuming 16-bit audio
            CoroutineScope(Dispatchers.IO).launch {
                //wait for playback duration
                delay(50L)
                //delay((durationInSeconds * 1000).toLong())  // Convert to milliseconds
                //delay(((audioData.size.toDouble() / (sampleRate * 2 * 1)) * 1000).toLong())
                //delay(audioData.size/(sampleRate*2.0).toLong()*1000)
                audioTrack.release()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            Log.e("AudioPlayback", "Error occurred during playback: ${e.message}")
        }
    }
    // Function for array token UID input popup window.
    private fun showInputDialog() {
        val builder = AlertDialog.Builder(this)
        builder.setTitle("Input Required")
        // Inflate the custom layout
        val inflater = layoutInflater
        val dialogView = inflater.inflate(R.layout.array_token_input, null)
        val editText = dialogView.findViewById<EditText>(R.id.editText_dialog_input)
        builder.setView(dialogView)
        // Set up the buttons
        builder.setPositiveButton("Confirm") { dialog, which ->
            val enteredText = editText.text.toString().trim()
            if (enteredText.isNotEmpty()) {
                arrayToken = enteredText // Save to your global variable
                Toast.makeText(this, "ID saved: $arrayToken", Toast.LENGTH_SHORT).show()
                // You can also update a TextView on your main screen to show the saved ID
                // For example: findViewById<TextView>(R.id.savedIdTextView).text = "Saved ID: $inputID"
            } else {
                Toast.makeText(this, "Input cannot be empty!", Toast.LENGTH_SHORT).show()
                // Optionally, you might want to prevent the dialog from closing if input is empty,
                // but AlertDialog.Builder makes this a bit tricky. For simple validation, this is fine.
            }
        }
        builder.setNegativeButton("Cancel") { dialog, which ->
            dialog.cancel() // Just close the dialog
            Toast.makeText(this, "Input cancelled.", Toast.LENGTH_SHORT).show()
        }
        // Create and show the AlertDialog
        val alertDialog = builder.create()
        alertDialog.show()
    }
}


package com.mcevoy.syncrecordapp
//TODO: Disable buttons when socket connection with host is lost.
import android.Manifest
import android.content.ContentValues
import android.content.ContentValues.TAG
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
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
import android.net.Uri
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
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
import kotlinx.coroutines.DelicateCoroutinesApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
// To allow self-signed certificates used on local servers
import okhttp3.OkHttpClient
import java.io.InputStream
import java.net.URI
import java.security.KeyStore
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManagerFactory
import javax.net.ssl.X509TrustManager
import okhttp3.Request
import okio.buffer
import okio.sink
import com.mcevoy.syncrecordapp.DownloadItem

// Request device microphone
const val REQUEST_CODE_MIC = 200

// Server types. Can be local or cloud deployment. Each is done differently.
// TODO: Add instruction comments about different deployments

enum class ServerType {
    CLOUD, LOCAL
}

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
    // Variables for master device
    private var master = false
    private lateinit var arrayToken: String
    private var connectedDevices: MutableList<String> = mutableListOf()
    private lateinit var ed: String
    private lateinit var recordingDevices: Array<Int?>
    private lateinit var stoppedDevices: Array<Int?>
    private var socketAddress: String = "https://syncrecord.eu:3000"
    //private var socketAddress: String = "192.168.1.6:3000"
    //buttons
    private lateinit var btnJoin: Button
    private lateinit var btnCreate: Button
    private lateinit var btnRecord: Button
    private lateinit var btnStop: Button
    private lateinit var btnCalibrate: Button
    private lateinit var btnSyncRecord: Button
    // Download audio files
    //private lateinit var downloadFilesRecyclerView: RecyclerView
    //private lateinit var downloadFilesAdapter: DownloadFilesAdapter
    //private val downloadItems = mutableListOf<DownloadItem>()

    // --- NEW: Socket Address Configuration ---
    private var currentServerType: ServerType = ServerType.CLOUD // Default to Cloud
    private var currentSocketAddress: String = "https://syncrecord.eu:3000" // Default Cloud address

    private val CLOUD_SERVER_DOMAIN = "https://syncrecord.eu"
    private val SERVER_PORT = 3000 // Ensure this matches your server's port for both local and cloud

    // Lazy initialization for self-signed certificate and its fingerprint
    private val selfSignedCert: X509Certificate by lazy {
        val cf: CertificateFactory = CertificateFactory.getInstance("X.509")
        val caInput: InputStream = resources.openRawResource(R.raw.cert) // Make sure R.raw.cert points to your .crt/.pem file
        caInput.use { cf.generateCertificate(it) } as X509Certificate
    }
    private val selfSignedCertFingerprint: String by lazy { extractCertFingerprint(selfSignedCert) }
    // --- END NEW ---

    // Shared preferences for persistent options
    private lateinit var sharedPreferences: SharedPreferences

    // Data class for your download items
    //data class DownloadItem(val fileName: String, val downloadLink: String)

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
        // Get and load stored preferences
        sharedPreferences = getSharedPreferences("app_settings", Context.MODE_PRIVATE)

        loadSettingsFromSharedPreferences()
        //Check if access to unprocessed audio data is available on device
        checkUnprocessedAudioSupport()
        // Get permissions to access the device microphone
        permissionGranted = ActivityCompat.checkSelfPermission(this, permissions[0]) == PackageManager.PERMISSION_GRANTED
        if(!permissionGranted)
            ActivityCompat.requestPermissions(this, permissions, REQUEST_CODE_MIC)

        // Interface
        btnJoin = findViewById(R.id.joinButton)
        btnCreate = findViewById(R.id.createButton)
        btnRecord = findViewById(R.id.recordButton)
        btnStop = findViewById(R.id.stopButton)
        btnCalibrate = findViewById(R.id.calibrateButton)
        btnSyncRecord = findViewById(R.id.SyncRecordBtn)
        debugText = findViewById(R.id.textView)
        roomText = findViewById(R.id.textViewRoom)
        deviceText = findViewById(R.id.textViewDevNum)
        roomTextStatic = findViewById(R.id.textViewRoomStatic)
        devNumStatic = findViewById(R.id.textViewDevNumStatic)

        // Initialize SocketManager with the default cloud configuration
        // This will now use the new connectToServer logic internally
        initSocketManager(currentServerType, currentSocketAddress)
        //socketManager = SocketManager(socketAddress,this)

        // Button for joining an existing array / session
        btnJoin.setOnClickListener {
            // Popup window to enter array unique ID.
            showInputDialog();
            roomTextStatic.isVisible = true
            devNumStatic.isVisible = true
        }
        // Button for creating a new array / session
        btnCreate.setOnClickListener {
            // TODO: Create Array sequence
            arrayToken = generateRandomCode(4)
            master = true
            roomText.text = arrayToken
            val data = JSONObject()
            data.put("room",arrayToken)
            socketManager.sendJoinRoom(data)
            btnJoin.isEnabled = false
            btnCreate.isEnabled = false
            btnRecord.isVisible = true
            btnRecord.isEnabled = false
            btnStop.isVisible = true
            btnStop.isEnabled = false
            btnSyncRecord.isVisible = true
            btnCalibrate.isVisible = true
            roomTextStatic.isVisible = true
            devNumStatic.isVisible = true
        }

        /* Calibrating codes:
            0 : Recording with no synchronisation
            1 : Localising devices with no recording
            2 : Synchronised recording -> Localising, synchronising and recording
         */

        // Button for unsynchronised recording
        btnRecord.setOnClickListener {
            recordingDevices = arrayOfNulls(connectedDevices.size)
            stoppedDevices = arrayOfNulls(connectedDevices.size)
            readyDevices = arrayOfNulls(connectedDevices.size)
            ed = Instant.now().toEpochMilli().toString()
            val data = JSONObject()
            data.put("command","Start")
            data.put("timedate",ed)
            data.put("numDevices",connectedDevices.size.toString())
            data.put("room",arrayToken)
            data.put("master",socketManager.getSocketId().toString())
            data.put("calibrating",0)
            socketManager.sendDistanceRecord(data)
        }
        // Button for stopping recording
        btnStop.setOnClickListener {
            val data = JSONObject()
            data.put("command","Stop")
            data.put("room",arrayToken)
            data.put("timedate",ed)
            data.put("master",socketManager.getSocketId().toString())
            data.put("calibrating",0)
            socketManager.sendDistanceRecord(data)
        }
        // Button for localising devices, with no recording
        btnCalibrate.setOnClickListener {
            btnCalibrate.isEnabled = false
            recordingDevices = arrayOfNulls(connectedDevices.size)
            stoppedDevices = arrayOfNulls(connectedDevices.size)
            readyDevices = arrayOfNulls(connectedDevices.size)
            ed = Instant.now().toEpochMilli().toString()
            val data = JSONObject()
            data.put("command","Start")
            data.put("timedate",ed)
            data.put("numDevices",connectedDevices.size.toString())
            data.put("room",arrayToken)
            data.put("master",socketManager.getSocketId().toString())
            data.put("calibrating",1)
            socketManager.sendDistanceRecord(data)
        }
        btnSyncRecord.setOnClickListener {
            btnSyncRecord.isEnabled = false
            recordingDevices = arrayOfNulls(connectedDevices.size)
            stoppedDevices = arrayOfNulls(connectedDevices.size)
            readyDevices = arrayOfNulls(connectedDevices.size)
            ed = Instant.now().toEpochMilli().toString()
            val data = JSONObject()
            data.put("command","Start")
            data.put("timedate",ed)
            data.put("numDevices",connectedDevices.size.toString())
            data.put("room",arrayToken)
            data.put("master",socketManager.getSocketId().toString())
            data.put("calibrating",2)
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

    // --- NEW: initSocketManager function ---
    // This function encapsulates the logic to create/re-create SocketManager
    // with the appropriate OkHttpClient based on server type.
    private fun initSocketManager(serverType: ServerType, address: String?) {
        val baseUrl: String // Declared within this function's scope
        val okHttpClientBuilder = OkHttpClient.Builder()
        val opts = io.socket.client.IO.Options() // Declared within this function's scope
        opts.forceNew = true
        opts.reconnection = true

        when (serverType) {
            ServerType.CLOUD -> {
                // If user enters a custom domain/IP for cloud, use it. Otherwise, use default.
                baseUrl = if (address.isNullOrBlank() || address.startsWith("https://")) { // Check for existing protocol
                    if (address.isNullOrBlank()) CLOUD_SERVER_DOMAIN else address
                } else { // Assume it's a domain without protocol, add HTTPS and default port
                    "https://$address:$SERVER_PORT"
                }
                // For cloud, use default OkHttpClient. No custom SSL/HostnameVerifier.
            }
            ServerType.LOCAL -> {
                if (address.isNullOrBlank()) {
                    runOnUiThread { Toast.makeText(this, "Local IP cannot be empty!", Toast.LENGTH_LONG).show() }
                    Log.e("MainActivity", "Local IP not provided for local server type.")
                    return // Do not proceed with SocketManager initialization
                }
                baseUrl = if (address.startsWith("https://")) address else "https://$address:$SERVER_PORT"

                // For local, configure custom SSL and HostnameVerifier
                val tmfAlgorithm: String = TrustManagerFactory.getDefaultAlgorithm()
                val tmf: TrustManagerFactory = TrustManagerFactory.getInstance(tmfAlgorithm).apply {
                    val keyStore = KeyStore.getInstance(KeyStore.getDefaultType()).apply {
                        load(null, null)
                        setCertificateEntry("ca", selfSignedCert)
                    }
                    init(keyStore)
                }

                val sslContext: SSLContext = SSLContext.getInstance("TLS").apply {
                    init(null, tmf.trustManagers, null)
                }

                okHttpClientBuilder
                    .sslSocketFactory(sslContext.socketFactory, tmf.trustManagers[0] as X509TrustManager)
                    .hostnameVerifier { hostname, session ->
                        val peerCert = session.peerCertificates.firstOrNull() as? X509Certificate
                        if (peerCert == null) {
                            Log.e("HostnameVerifier", "No peer certificate found for hostname: $hostname")
                            return@hostnameVerifier false
                        }

                        val peerCertFingerprint = extractCertFingerprint(peerCert)
                        val isYourSelfSignedCert = selfSignedCertFingerprint == peerCertFingerprint
                        Log.d("HostnameVerifier", "Is our self-signed cert ($hostname)? $isYourSelfSignedCert")

                        // This part needs careful consideration for local IPs
                        // A hostname like "192.168.1.100" won't have a direct match in the cert's CN or SANs.
                        // The primary check here is that it's *our* self-signed cert AND it's a local IP.
                        val isLocalNetworkIp = hostname.startsWith("192.168.") || hostname.startsWith("10.") || hostname == "localhost" || hostname == "127.0.0.1"
                        Log.d("HostnameVerifier", "Is local network IP ($hostname)? $isLocalNetworkIp")

                        isYourSelfSignedCert && isLocalNetworkIp
                    }
            }
        }

        // Build the OkHttpClient instance (conditional setup already applied to builder)
        val finalOkHttpClient = okHttpClientBuilder.build()
        opts.callFactory = finalOkHttpClient
        opts.webSocketFactory = finalOkHttpClient

        val serverUri = try {
            URI(baseUrl)
        } catch (e: Exception) {
            runOnUiThread { Toast.makeText(this, "Invalid socket address format: ${e.message}", Toast.LENGTH_LONG).show() }
            Log.e("MainActivity", "Invalid URI format: $baseUrl, Error: ${e.message}")
            connectionErrorMessage("Invalid address format")
            return
        }

        Log.d("SocketManager", "Initializing SocketManager with URI: $serverUri")

        // This is the line that *sets* the class-level socketManager.
        // serverUri and opts are available here because they are declared within initSocketManager.
        if (::socketManager.isInitialized) {
            socketManager.disconnect()
        }
        socketManager = SocketManager(this.applicationContext, this)
        runOnUiThread { debugText.text = "Attempting connection to ${serverUri.host}" }
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
            // Start recording audio
            val calibrating = data.getInt("calibrating")
            startRecording(timedate,room,datamaster,calibrating)
        }
        else if(command == "Stop") {
            /*
            runOnUiThread {
                debugText.text = "Stop Received"
            }
            */
            val calibrating = data.getInt("calibrating")
            stopRecording(timedate,room,datamaster,calibrating)
        }
        else if(command == "Started" && master) {

            runOnUiThread {
                debugText.text = "Received Started from device"
            }

            val device = data.getString("device")
            val devInArray = data.getString("devinarray")
            val calibrating = data.getInt("calibrating")

            recordingDevices[devInArray.toInt()-1] = 1
            val allRecording = recordingDevices.all { it == 1 }
            if(recordingDevices.size == connectedDevices.size && allRecording) {
                runOnUiThread {
                    debugText.text = "All recording devices started"
                }
                if(calibrating > 0){
                    //Start the PRBS sequences
                    val sendData = JSONObject()
                    sendData.put("timedate",timedate)
                    sendData.put("command","PRBSPlay")
                    sendData.put("device",connectedDevices[0].toString())
                    sendData.put("room",room)
                    sendData.put("master",datamaster)
                    if(calibrating == 1) sendData.put("calibrating",1)
                    else if(calibrating == 2) sendData.put("calibrating",2)
                    socketManager.sendDistanceRecord(sendData)
                }
                else{
                    // Not localising or synchronising
                    // Do something?

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
            val calibrating = data.getInt("calibrating")

            stoppedDevices[devInArray.toInt()-1] = 1
            val allStopped = stoppedDevices.all { it == 1 }
            if(stoppedDevices.size == connectedDevices.size && allStopped) {
                if(calibrating > 0){
                    val sendData = JSONObject()
                    sendData.put("timedate",timedate)
                    sendData.put("command","Sync")
                    sendData.put("room",room)
                    sendData.put("devices", connectedDevices.size)
                    sendData.put("master",datamaster)
                    if(calibrating == 1) sendData.put("calibrating",1)
                    else if(calibrating == 2) sendData.put("calibrating",2)
                    // Send message after 1 second
                    val handler = Handler(Looper.getMainLooper())
                    handler.postDelayed({
                        socketManager.sendDistanceRecord(sendData)
                    }, 1000)
                }
                if(calibrating == 0) {
                    val sendData = JSONObject()
                    sendData.put("timedate", timedate)
                    sendData.put("command", "SyncAudio")
                    sendData.put("devices", connectedDevices.size)
                    sendData.put("room", room)
                    sendData.put("master", datamaster)
                    sendData.put("calibrating", 0)
                    socketManager.sendDistanceRecord(sendData)
                }
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
                val calibrating = data.getInt("calibrating")
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
            val calibrating = data.getInt("calibrating")
            // If all devices are not finished -> Send play command to next device
            readyDevices[devInArray.toInt()-1] = 1
            val allFinished = readyDevices.all { it == 1 }
            if(readyDevices.size == connectedDevices.size && allFinished) {
                // All devices finished playing PRBS
                runOnUiThread {
                    Toast.makeText(
                        this,
                        "Received PRBS finished from Device $devInArray All devices ready: $allFinished",
                        Toast.LENGTH_LONG
                    ).show()
                }
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

        else if(command == "ReadyForSync" && master) {
            runOnUiThread{
                Toast.makeText(
                    this,
                    "Microphone array is calibrated.",
                    Toast.LENGTH_LONG
                ).show()
                btnRecord.isEnabled = true
                btnStop.isEnabled = true
                btnCalibrate.isEnabled = true
                btnSyncRecord.isEnabled = true
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
        inflater.inflate(R.menu.options_menu, popup.menu) // Assuming R.menu.options_menu is correct
        popup.setOnMenuItemClickListener { item: MenuItem ->
            when (item.itemId) {
                R.id.action_socket_address -> { // Assuming this is your menu item ID
                    val dialog = SettingsDialogFragment.newInstance(currentSocketAddress, currentServerType)
                    dialog.show(supportFragmentManager, "SettingsDialog")
                    true
                }
                R.id.action_view_downloads -> { // Assuming this is your menu item ID
                    val intent = Intent(this, DownloadsActivity::class.java)
                    // No need to pass via Intent if DownloadsActivity will read from SharedPreferences
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
        if(requestCode == REQUEST_CODE_MIC)
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
    private fun startRecording(timedate: String, room: String, datamaster: String, calibrating: Int){
        if(!permissionGranted){
            ActivityCompat.requestPermissions(this, permissions, REQUEST_CODE_MIC)
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

        if(master) {
            if(btnCalibrate.isEnabled) {
                runOnUiThread {
                    btnCalibrate.isEnabled = false
                }
            }
        }

        val data = JSONObject()
        data.put("command","Started")
        data.put("timedate",timedate)
        data.put("devinarray",deviceText.text.toString())
        data.put("room",room)
        data.put("master",datamaster)
        data.put("device",socketManager.getSocketId().toString())
        data.put("calibrating",calibrating)
        socketManager.sendDistanceRecord(data)
    }
    private fun stopRecording(timedate: String, room: String, datamaster: String, calibrating: Int){
        if(isRecording){
            isRecording = false
            audioRecord.stop()
            audioRecord.release()
        }
        /*
        btnCalibrate.isEnabled = true
        */
        val data = JSONObject()
        data.put("command","Stopped")
        data.put("timedate",timedate)
        data.put("devinarray",deviceText.text.toString())
        data.put("room",room)
        data.put("master",datamaster)
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
    // This method is called when the OK button in SettingsDialogFragment is pressed.
    override fun sendInput(inputAddress: String, serverType: ServerType) {
        // This method is called when the OK button in SettingsDialogFragment is pressed
        currentSocketAddress = inputAddress
        currentServerType = serverType

        // Save the updated settings to SharedPreferences
        saveSettingsToSharedPreferences(inputAddress, serverType)

        // Optional: Show a toast or update UI to confirm settings applied
        Toast.makeText(this, "Socket Address: $inputAddress, Server Type: $serverType saved.", Toast.LENGTH_SHORT).show()

        // If your SocketManager needs to reconnect with the new address, do it here
        // For example:
        socketManager.disconnect()
        initSocketManager(currentServerType,currentSocketAddress)
    }

    // Downloading audio files from server
    //private fun addNewDownloadLink(fileName: String, downloadLink: String) {
        //val newItem = DownloadItem(fileName, downloadLink)
        //downloadFilesAdapter.addDownloadItem(newItem)
    //}

    // Socket.IO code to handle receiving new download links
    //private fun onDownloadLinkReceived(fileName: String, downloadLink: String) {
        //runOnUiThread {
            //addNewDownloadLink(fileName, downloadLink)
        //}
    //}

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
                val data = JSONObject()
                data.put("room",arrayToken)
                socketManager.sendJoinRoom(data)
                runOnUiThread {
                    roomText.text = arrayToken.toString()
                }
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

    // Helper to extract SHA-256 fingerprint (unchanged)
    private fun extractCertFingerprint(cert: X509Certificate): String {
        return try {
            val md = java.security.MessageDigest.getInstance("SHA-256")
            val publicKeyBytes = cert.encoded
            val digest = md.digest(publicKeyBytes)
            digest.joinToString(":") { "%02x".format(it) }
        } catch (e: Exception) {
            Log.e("CertFingerprint", "Error getting fingerprint: ${e.message}")
            ""
        }
    }

    // Function for downloading audio files from server
    @OptIn(DelicateCoroutinesApi::class)
    private fun startDownload(link: String) {
        //val serverIp = "YOUR_SERVER_IP" // **IMPORTANT: Replace with your Node.js server's IP**
        //val serverPort = 3000 // Match your Node.js server port

        //val identifier = "test_user" // Or get this dynamically (e.g., user ID)
        val downloadUrl = "http://$socketAddress/tmp/$link"
        val fileName = "${link}.zip"

        Toast.makeText(this, "Starting download...", Toast.LENGTH_SHORT).show()

        // Use a Coroutine for network operations to avoid blocking the main thread
        GlobalScope.launch(Dispatchers.IO) { // Run on a background thread
            val client = OkHttpClient()
            val request = Request.Builder().url(downloadUrl).build()

            try {
                client.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) {
                        launch(Dispatchers.Main) {
                            Toast.makeText(this@MainActivity, "Download failed: ${response.code}", Toast.LENGTH_LONG).show()
                        }
                        Log.e(TAG, "Download failed: ${response.code} - ${response.message}")
                        return@launch
                    }

                    // --- Save file using MediaStore (Recommended for Android 10+) ---
                    val contentValues = ContentValues().apply {
                        put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                        put(MediaStore.MediaColumns.MIME_TYPE, "application/zip")
                        // Use RELATIVE_PATH to put it directly in the Downloads folder
                        put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                    }

                    var uri: Uri? = null
                    try {
                        contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)?.let { insertedUri ->
                            uri = insertedUri
                            contentResolver.openOutputStream(insertedUri)?.use { outputStream ->
                                response.body?.source()?.readAll(outputStream.sink())
                            }
                            launch(Dispatchers.Main) {
                                Toast.makeText(this@MainActivity, "Download complete: $fileName", Toast.LENGTH_LONG).show()
                            }
                            Log.d(TAG, "File downloaded to: $insertedUri")
                        } ?: run {
                            throw Exception("Failed to create new MediaStore entry for $fileName")
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Error saving file via MediaStore: ${e.message}", e)
                        // If an error occurred, try to delete the partially created entry
                        uri?.let { contentResolver.delete(it, null, null) }
                        launch(Dispatchers.Main) {
                            Toast.makeText(this@MainActivity, "Error saving file: ${e.message}", Toast.LENGTH_LONG).show()
                        }
                    }

                    // --- OR: Save to app-specific external storage (alternative for app-private files) ---
                    // This is for files your app primarily uses and doesn't need to be user-discoverable in Downloads
                    /*
                    val appSpecificDownloadsDir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
                    val appSpecificFile = File(appSpecificDownloadsDir, fileName)
                    appSpecificFile.outputStream().use { output ->
                        response.body?.source()?.readAll(output.sink())
                    }
                    launch(Dispatchers.Main) {
                        Toast.makeText(this@MainActivity, "Download complete (App-specific): $fileName", Toast.LENGTH_LONG).show()
                    }
                    Log.d(TAG, "File downloaded to app-specific: ${appSpecificFile.absolutePath}")
                    */
                }
            } catch (e: Exception) {
                launch(Dispatchers.Main) {
                    Toast.makeText(this@MainActivity, "Network error: ${e.message}", Toast.LENGTH_LONG).show()
                }
                Log.e(TAG, "Network error:", e)
            }
        }
    }

    // Loading persistent option settings
    private fun loadSettingsFromSharedPreferences() {
        // Default values if not found in preferences
        val defaultAddress = "https://syncrecord.eu:3000" // Or your production default
        val defaultServerType = ServerType.CLOUD
        currentSocketAddress = sharedPreferences.getString("socket_address", defaultAddress) ?: defaultAddress
        val serverTypeString = sharedPreferences.getString("server_type", defaultServerType.name)
        currentServerType = ServerType.valueOf(serverTypeString ?: defaultServerType.name)
        runOnUiThread { Toast.makeText(this, "Loaded settings: Address=$currentSocketAddress, Type=$currentServerType", Toast.LENGTH_LONG).show() }
        Log.d("MainActivity", "Loaded settings: Address=$currentSocketAddress, Type=$currentServerType")
    }

    // Saving persistent option settings
    private fun saveSettingsToSharedPreferences(address: String, serverType: ServerType) {
        with (sharedPreferences.edit()) {
            putString("socket_address", address)
            putString("server_type", serverType.name) // Save enum as its name string
            apply() // Apply changes asynchronously
        }
        Log.d("MainActivity", "Saved settings: Address=$address, Type=$serverType")
    }

    override fun onDownloadReady(data: DownloadItem) {
        // Add download link to list
        runOnUiThread {
            Toast.makeText(this, "New Download Ready.", Toast.LENGTH_LONG).show()
            debugText.text = "Download Received: ${data.fileName} Link: ${data.downloadLink}"
        }
    }
}


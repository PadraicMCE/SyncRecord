// SocketManager.kt
package com.mcevoy.syncrecordapp

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import io.socket.client.IO
import io.socket.client.Socket
import io.socket.emitter.Emitter
import io.socket.engineio.client.EngineIOException
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import org.json.JSONException
import org.json.JSONObject
import java.net.URI
import java.net.URISyntaxException

import com.mcevoy.syncrecordapp.DownloadItem

// Data class for your download items (ensure this is in DownloadItem.kt ONLY)
// data class DownloadItem(val fileName: String, val downloadLink: String)

// Define your ServerType enum (ensure this is in a common place like a ServerType.kt file ONLY)
// enum class ServerType { LOCAL, CLOUD }

// Interface for callbacks (SocketManagerCallback.kt)
// Make sure it includes the onDownloadReady method
// interface SocketManagerCallback { /* ... existing methods ... */ fun onDownloadReady(downloadItem: DownloadItem) }

class SocketManager(private val context: Context, private val currentInstanceCallback: SocketManagerCallback) {

    // --- Companion object manages the single underlying Socket instance and shared resources ---
    companion object {
        private var internalSocket: Socket? = null
        private var isInternalSocketInitialized = false
        // This will hold the callback of the *most recently created/reconnected* SocketManager instance.
        // This allows the static listeners to call back to the currently active Activity.
        private var currentActiveCallback: SocketManagerCallback? = null

        // NEW: Private variable to store the URI the internalSocket was last connected to
        private var lastConnectedUri: String? = null

        // NEW: Private mutable flow for internal emission of download items
        private val _newDownloadLinks = MutableSharedFlow<DownloadItem>(extraBufferCapacity = 1)
        // Publicly expose as a read-only SharedFlow. DownloadsActivity will observe this.
        val newDownloadLinks: SharedFlow<DownloadItem> = _newDownloadLinks.asSharedFlow()

        // Default values for initial setup
        private const val DEFAULT_SOCKET_ADDRESS = "https://syncrecord.eu:3000"

        // Static initialization method for the *single* socket connection
        fun initializeAndConnectSocket(context: Context, callback: SocketManagerCallback? = null) {
            // Update the currently active callback
            currentActiveCallback = callback

            // If the socket is already initialized and connected, just update the callback and return
            if (isInternalSocketInitialized && internalSocket?.connected() == true) {
                Log.d("SocketManager.Companion", "Socket already initialized and connected. Updating callback.")
                currentActiveCallback?.setButtonsActive()
                currentActiveCallback?.connectionErrorMessage("")
                return
            }

            // Load settings from SharedPreferences
            val sharedPref = context.applicationContext.getSharedPreferences("app_settings", Context.MODE_PRIVATE)
            val savedSocketAddress = sharedPref.getString("socket_address", DEFAULT_SOCKET_ADDRESS) ?: DEFAULT_SOCKET_ADDRESS

            val opts = IO.Options().apply {
                forceNew = false // Allow reuse of existing transport for same URI if available
                reconnection = true
                reconnectionDelay = 1000
                reconnectionAttempts = 10
                timeout = 5000 // Connection timeout
                // Add this if you are using an OkHttpClient for the socket.io client
                // val okHttpClient = OkHttpClient.Builder()
                //     .hostnameVerifier { _, _ -> true } // For self-signed certs (DEV ONLY)
                //     .sslSocketFactory(getUnsafeOkHttpClient().sslSocketFactory, getUnsafeOkHttpClient().trustManager as X509TrustManager) // For self-signed certs (DEV ONLY)
                //     .build()
                // callFactory = okHttpClient
            }

            try {
                val uri = URI.create(savedSocketAddress)
                // Only create a new socket if it's null or the URI has changed
                if (internalSocket == null || !isInternalSocketInitialized || lastConnectedUri != savedSocketAddress) { // FIX: Use lastConnectedUri for comparison
                    internalSocket?.disconnect() // Disconnect old if URI changed
                    internalSocket?.off() // Remove old listeners
                    internalSocket = IO.socket(uri, opts)
                    initialiseSocketListeners() // Attach listeners to the new/reused socket
                    Log.d("SocketManager.Companion", "New/reused socket instance for: $savedSocketAddress")
                } else {
                    Log.d("SocketManager.Companion", "Reusing existing socket instance for: $savedSocketAddress")
                }

                internalSocket?.connect()
                lastConnectedUri = savedSocketAddress
                currentActiveCallback?.connectionErrorMessage("") // Clear previous error messages
                Log.d("SocketManager.Companion", "Socket connecting to: $savedSocketAddress")
                isInternalSocketInitialized = true

            } catch (e: URISyntaxException) {
                val errorMessage = "Error parsing URI: $savedSocketAddress. Error: ${e.message}"
                Log.e("SocketManager.Companion", errorMessage)
                currentActiveCallback?.connectionErrorMessage("Error connecting to socket host. Check the socket host address in settings.")
                isInternalSocketInitialized = false
            } catch (e: Exception) {
                val errorMessage = "Unexpected error initializing socket: ${e.message}"
                Log.e("SocketManager.Companion", errorMessage, e)
                currentActiveCallback?.connectionErrorMessage("An unexpected error occurred during connection setup.")
                isInternalSocketInitialized = false
            }
        }

        // Listener setup for the *shared* internalSocket
        private fun initialiseSocketListeners() {
            // Remove previous listeners to avoid duplicates if this is called on a reused socket
            internalSocket?.off() // Remove all existing listeners attached via .on()

            internalSocket?.on(Socket.EVENT_CONNECT) {
                Log.d("SocketManager.Companion", "Connected to server: ${internalSocket?.id()}")
                currentActiveCallback?.setButtonsActive()
                currentActiveCallback?.connectionErrorMessage("")
            }
            internalSocket?.on(Socket.EVENT_DISCONNECT) { args ->
                val reason = args.getOrNull(0) as? String ?: "Unknown reason"
                Log.d("SocketManager.Companion", "Socket disconnected. Reason: $reason")
                currentActiveCallback?.connectionErrorMessage("Disconnected from server: $reason")
            }
            internalSocket?.on(Socket.EVENT_CONNECT_ERROR) { args ->
                val error = if (args.isNotEmpty() && args[0] is EngineIOException) args[0] as EngineIOException else null
                val errorMessage = error?.message ?: "Unknown connection error"
                Log.e("SocketManager.Companion", "Socket connection error: $errorMessage", error)
                currentActiveCallback?.connectionErrorMessage("Error connecting to socket host: $errorMessage. Check the socket host address in settings.")
            }

            // Your existing listeners, now using currentActiveCallback
            internalSocket?.on("assignDevice") { args ->
                val devicenum = args[0] as String
                val socketid = args[1] as String
                val roomToken = args[2] as String
                Log.d("SocketManager.Companion", "Assign device received: DevNum=$devicenum, SocketID=$socketid, Room=$roomToken")
                // Assuming you have a callback for this in SocketManagerCallback
                // currentActiveCallback?.onAssignDevice(devicenum, socketid, roomToken)
            }
            internalSocket?.on("DevNumAssigned") { args ->
                val devInArray = args[0]
                Log.d("SocketManager.Companion", "Device number assigned: $devInArray")
                currentActiveCallback?.onDevNumAssigned(devInArray.toString())
            }
            internalSocket?.on("Number of Devices") { args ->
                val data = args[0] as JSONObject
                val number = data.getString("device")
                Log.d("SocketManager.Companion", "Number of devices: $number")
                currentActiveCallback?.onNumberOfDevices(number.toString())
            }
            internalSocket?.on("distanceRecord") { args ->
                val data = args[0] as JSONObject
                Log.d("SocketManager.Companion", "Distance record received: $data")
                currentActiveCallback?.onReceivedDistanceRecord(data)
            }
            internalSocket?.on("joinedRoom") { args ->
                val data = args[0] as JSONObject
                Log.d("SocketManager.Companion", "Joined room confirmation: $data")
                currentActiveCallback?.onReceivedJoinedRoom(data)
            }
            internalSocket?.on("DownloadReady") { args ->
                val data = args[0] as JSONObject
                Log.d("SocketManager.Companion", "Download ready event received: $data")
                try {
                    val fileName = data.getString("timedate")
                    val downloadLink = data.getString("downloadLink")
                    val downloadItem = DownloadItem(fileName, downloadLink)
                    Log.d("SocketManager.Companion", "Emitting download item: $fileName")
                    _newDownloadLinks.tryEmit(downloadItem) // Use the private mutable flow here
                    currentActiveCallback?.onDownloadReady(downloadItem) // ALSO notify the active callback
                } catch (e: JSONException) {
                    Log.e("SocketManager.Companion", "JSON parsing error for 'DownloadReady': ${e.message}", e)
                }
            }
        }

        // Static method to disconnect the socket
        fun disconnectSharedSocket() {
            if (internalSocket?.connected() == true) {
                internalSocket?.disconnect()
                internalSocket?.off() // Remove all listeners
                Log.d("SocketManager.Companion", "Shared Socket disconnected and listeners removed.")
                isInternalSocketInitialized = false
                internalSocket = null // Clear the instance
                currentActiveCallback?.connectionErrorMessage("Disconnected from server.")
            }
        }

        // Static method to reconnect the shared socket
        fun reconnectSharedSocket(context: Context, newCallback: SocketManagerCallback? = null) {
            disconnectSharedSocket() // Disconnect current connection
            initializeAndConnectSocket(context, newCallback) // Re-initialize with new context/callback
        }

        // Static method to emit events using the shared socket
        fun emit(event: String, vararg args: Any) {
            if (internalSocket?.connected() == true) {
                internalSocket?.emit(event, *args)
            } else {
                Log.w("SocketManager.Companion", "Cannot emit '$event': Shared Socket is not connected.")
                currentActiveCallback?.connectionErrorMessage("Cannot send command, not connected to server.")
            }
        }

        // Static methods to get socket info from the shared socket
        fun getSharedSocketId(): String? = internalSocket?.id()
        fun isSharedSocketConnected(): Boolean = internalSocket?.connected() == true
    } // End of companion object

    // --- Constructor and instance methods delegate to the companion object ---
    init {
        // When a SocketManager instance is created, ensure the shared socket is initialized
        // and register this instance's callback as the currently active one.
        initializeAndConnectSocket(context, currentInstanceCallback)
    }

    // Public methods for instances of SocketManager (delegate to companion object)
    fun disconnect() = disconnectSharedSocket()
    fun reconnect(context: Context) = reconnectSharedSocket(context, currentInstanceCallback) // Pass current instance's callback
    fun emit(event: String, vararg args: Any) = Companion.emit(event, *args)
    fun getSocketId(): String? = getSharedSocketId()
    fun isConnected(): Boolean = isSharedSocketConnected()

    // Your existing send methods, now using the companion object's emit
    fun sendJoinRoom(data: JSONObject) {
        emit("joinRoom", data)
        Log.d("SocketManager", "Sent joinRoom: $data")
    }
    fun sendAudio(data: JSONObject){
        emit("audioData",data)
    }
    fun sendDistanceRecord(data: JSONObject){
        emit("distanceRecord",data)
        Log.d("SocketManager", "Sent distanceRecord: $data")
    }
    fun sendAssignDevice(data: JSONObject) {
        emit("assignDevice",data)
        Log.d("SocketManager", "Sent assignDevice: $data")
    }
    fun sendDeviceIds(data: JSONObject) {
        emit("deviceIds",data)
        Log.d("SocketManager", "Sent deviceIds: $data")
    }
}
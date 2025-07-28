package com.mcevoy.syncrecordapp

import io.socket.client.IO
import io.socket.client.Socket
import io.socket.emitter.Emitter
import org.json.JSONObject
import java.net.URISyntaxException
import java.net.URI
import io.socket.engineio.client.EngineIOException
import android.util.Log
import com.mcevoy.syncrecordapp.DownloadItem

class SocketManager (private val serverurl: String, private val valCallback: SocketManagerCallback, private val opts: IO.Options) { // Changed callback parameter name to avoid conflict
    private lateinit var internalSocket: Socket // Renamed to avoid potential conflict with the Socket.kt class name if present
    private val callback: SocketManagerCallback = valCallback // Explicitly make it a class property

    init {
        try {
            val uri = URI.create(serverurl)
            // Use the opts passed from MainActivity, which contains the configured OkHttpClient
            internalSocket = IO.socket(uri, opts) // Initialise the internalSocket
            initialiseSocketListeners()
            internalSocket.connect() // Call connect on the initialised socket
            callback.connectionErrorMessage("")
            Log.d("SocketManager", "Socket initialized and connecting to: $serverurl")
        } catch (e: URISyntaxException) {
            Log.e("SocketManager", "Error parsing URI: $serverurl. Error: ${e.message}")
            callback.connectionErrorMessage("Error connecting to socket host. Check the socket host address in settings.")
        } catch (e: Exception) {
            Log.e("SocketManager", "Unexpected error initializing socket: ${e.message}", e)
            callback.connectionErrorMessage("An unexpected error occurred during connection setup.")
        }
    }

    // Public getter for the socket object, if needed by MainActivity (e.g., socket.id())
    fun getSocket(): Socket {
        return internalSocket
    }

    private fun initialiseSocketListeners(){
        internalSocket.on(Socket.EVENT_CONNECT, Emitter.Listener {
            Log.d("SocketManager", "Connected to server: ${internalSocket.id()}")
            callback.setButtonsActive()
            callback.connectionErrorMessage("")
        })
        internalSocket.on(Socket.EVENT_CONNECT_ERROR) { args ->
            val error = if (args[0] is EngineIOException) args[0] as EngineIOException else null
            val errorMessage = error?.message ?: "Unknown connection error"
            Log.e("SocketManager", "Socket connection error: $errorMessage", error)
            callback.connectionErrorMessage("Error connecting to socket host: $errorMessage. Check the socket host address in settings.")
        }
        internalSocket.on(Socket.EVENT_DISCONNECT) { args ->
            val reason = args[0] as String
            Log.d("SocketManager", "Socket disconnected. Reason: $reason")
            callback.connectionErrorMessage("Disconnected from server: $reason")
            callback.setButtonsActive()
        }
        internalSocket.on("assignDevice", Emitter.Listener { args ->
            val devicenum = args[0] as String
            val socketid = args[1] as String
            val roomToken = args[2] as String
            Log.d("SocketManager", "Assign device received: DevNum=$devicenum, SocketID=$socketid, Room=$roomToken")
        })
        internalSocket.on("DevNumAssigned",Emitter.Listener { args ->
            val devInArray = args[0]
            Log.d("SocketManager", "Device number assigned: $devInArray")
            callback.onDevNumAssigned(devInArray.toString())
        })
        internalSocket.on("Number of Devices",Emitter.Listener { args ->
            val data = args[0] as JSONObject
            val number = data.getString("device")
            Log.d("SocketManager", "Number of devices: $number")
            callback.onNumberOfDevices(number.toString())
        })
        internalSocket.on("distanceRecord",Emitter.Listener { args ->
            val data = args[0] as JSONObject
            Log.d("SocketManager", "Distance record received: $data")
            callback.onReceivedDistanceRecord(data)
        })
        internalSocket.on("joinedRoom",Emitter.Listener { args ->
            val data = args[0] as JSONObject
            Log.d("SocketManager", "Joined room confirmation: $data")
            callback.onReceivedJoinedRoom(data)
        })
        internalSocket.on("DownloadReady",Emitter.Listener { args ->
            val data = args[0] as JSONObject
            //val link = data.getString("downloadLink")
            Log.d("SocketManager", "Download ready: $data")
            callback.onDownloadReady(data)
        })

    }
    fun sendJoinRoom(data: JSONObject) {
        internalSocket.emit("joinRoom",data)
        Log.d("SocketManager", "Sent joinRoom: $data")
    }
    fun sendAudio(data: JSONObject){
        internalSocket.emit("audioData",data)
    }
    fun sendDistanceRecord(data: JSONObject){
        internalSocket.emit("distanceRecord",data)
        Log.d("SocketManager", "Sent distanceRecord: $data")
    }
    fun sendAssignDevice(data: JSONObject) {
        internalSocket.emit("assignDevice",data)
        Log.d("SocketManager", "Sent assignDevice: $data")
    }
    fun sendDeviceIds(data: JSONObject) {
        internalSocket.emit("deviceIds",data)
        Log.d("SocketManager", "Sent deviceIds: $data")
    }
    fun disconnect() {
        if (::internalSocket.isInitialized && internalSocket.connected()) {
            internalSocket.disconnect()
            internalSocket.off()
            Log.d("SocketManager", "Socket disconnected and listeners removed.")
        }
    }
}
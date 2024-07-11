package com.mcevoy.syncrecordapp

import io.socket.client.IO
import io.socket.client.Socket
import io.socket.emitter.Emitter
import org.json.JSONObject
import java.net.URISyntaxException
import java.net.URI
import io.socket.engineio.client.EngineIOException
import android.util.Log


import com.mcevoy.syncrecordapp.SocketManagerCallback
class SocketManager (serverurl: String, private val callback: SocketManagerCallback) {
    lateinit var socket: Socket
    init{

        try {
            val uri = URI.create(serverurl)
            val opts = IO.Options()
            opts.secure = true //https
            opts.reconnection = true
            socket = IO.socket(uri,opts)
            initialiseSocketListeners()
            socket.connect()
            //println("Connected to socket")
        } catch (e: URISyntaxException) {
            // Error handle
            println("Error connecting to socket")
        }
    }
    private fun initialiseSocketListeners(){
        socket.on(Socket.EVENT_CONNECT, Emitter.Listener {
            // Connection function?
            println("Connected to server")
        })
        socket.on(Socket.EVENT_CONNECT_ERROR) { args ->
            val error = args[0] as EngineIOException
            Log.e("SocketManager", "Socket connection error: ${error.message}")
        }
        socket.on("assignDevice", Emitter.Listener { args ->
            val devicenum = args[0] as String
            val socketid = args[1] as String
            val roomToken = args[2] as String
            // Indicate device number on UI
        })

        /*
        socket.on("joinedRoom", Emitter.Listener { args ->
            var socketid = args[0] as String
            //Emit assignDevice
            //callback.received
            val data = JSONObject()
            data.put("device")
            socket.emit("assignDevice",)
        })*/

        socket.on("DevNumAssigned",Emitter.Listener { args ->
            val devInArray = args[0]
            //Handle the device in array
            callback.onDevNumAssigned(devInArray.toString())
        })
        socket.on("Number of Devices",Emitter.Listener { args ->
            val data = args[0] as JSONObject
            val number = data.getString("device")
            callback.onNumberOfDevices(number.toString())
        })
        socket.on("distanceRecord",Emitter.Listener { args ->
            val data = args[0] as JSONObject
            callback.onReceivedDistanceRecord(data)
        })
        socket.on("joinedRoom",Emitter.Listener { args ->
            val data = args[0] as JSONObject
            callback.onReceivedJoinedRoom(data)
        })
    }
    fun sendJoinRoom(roomToken: String) {
        socket.emit("joinRoom",roomToken)
    }
    fun sendAudio(data: JSONObject){
        socket.emit("audioData",data)
    }
    fun sendDistanceRecord(data: JSONObject){
        socket.emit("distanceRecord",data)
    }
    fun sendAssignDevice(data: JSONObject) {
        socket.emit("assignDevice",data)
    }
    fun sendDeviceIds(data: JSONObject) {
        socket.emit("deviceIds",data)
    }
}
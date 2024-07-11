package com.mcevoy.syncrecordapp

import org.json.JSONObject

interface SocketManagerCallback {
    //fun receivedJoinRoom(roomToken: String)
    //fun receivedDeviceAssigned(message: String)
    //fun receivedStartRecording(timedate: String, room: String, master: String)
    //fun sendJoinRoom(roomToken: String)
    fun onDevNumAssigned(devNum: String)
    fun onNumberOfDevices(number: String)
    fun onReceivedDistanceRecord(data: JSONObject)
    fun onReceivedJoinedRoom(data: JSONObject)
}
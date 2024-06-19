package com.mcevoy.syncrecordapp
interface SocketManagerCallback {
    fun receivedJoinRoom(roomToken: String)
    //fun receivedDeviceAssigned(message: String)
    //fun receivedStartRecording(timedate: String, room: String, master: String)
    //fun sendJoinRoom(roomToken: String)
}
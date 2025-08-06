package com.mcevoy.syncrecordapp

import org.json.JSONObject

interface SocketManagerCallback {
    fun onDevNumAssigned(devNum: String)
    fun onNumberOfDevices(number: String)
    fun onReceivedDistanceRecord(data: JSONObject)
    fun onReceivedJoinedRoom(data: JSONObject)
    fun setButtonsActive()
    fun connectionErrorMessage(message: String)
    fun onDownloadReady(data: DownloadItem)
    // REMOVE THIS LINE: fun sendInput(input: String)
}
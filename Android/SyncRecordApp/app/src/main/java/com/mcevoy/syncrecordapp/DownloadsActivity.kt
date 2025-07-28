// DownloadsActivity.kt
package com.mcevoy.syncrecordapp

import android.Manifest
import android.content.ContentValues
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okio.buffer
import okio.sink
import org.json.JSONException
import org.json.JSONObject // Import for parsing JSON from Socket.IO

// Data class for your download items (make sure this is in a common file or here)
//data class DownloadItem(val fileName: String, val downloadLink: String)

class DownloadsActivity : AppCompatActivity() {
    private val STORAGE_PERMISSION_CODE = 101
    private val TAG = "DownloadsActivity"
    private lateinit var downloadFilesAdapter: DownloadFilesAdapter
    private lateinit var socket: Socket

    // This variable will now get its value from SharedPreferences
    private var socketAddress: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_downloads)

        // --- NEW: Load socketAddress from SharedPreferences ---
        val sharedPref = getSharedPreferences("app_settings", Context.MODE_PRIVATE)
        val defaultAddress = "https://syncrecord.eu:3000" // Should match default in MainActivity
        socketAddress = sharedPref.getString("socket_address", defaultAddress) ?: defaultAddress

        if (socketAddress.isBlank()) {
            Toast.makeText(this, "Server address not configured. Please set in options menu.", Toast.LENGTH_LONG).show()
            Log.e(TAG, "Socket address is empty or not configured.")
            // Consider disabling Socket.IO or closing this activity if no address is set
            // finish() // Uncomment if you want to close if no address
            // return // Prevent further initialization if finishing
        }

        // Initialise RecyclerView
        val recyclerView: RecyclerView = findViewById(R.id.downloadFilesRecyclerView)
        recyclerView.layoutManager = LinearLayoutManager(this)

        // Initialise Adapter with the download callback
        downloadFilesAdapter = DownloadFilesAdapter(mutableListOf()) { downloadItem ->
            checkAndRequestPermissions(downloadItem.fileName, downloadItem.downloadLink)
        }
        recyclerView.adapter = downloadFilesAdapter

        // Initialize Socket.IO connection using the loaded address
        setupSocketIO()
    }

    private fun setupSocketIO() {
        try {
            // Use the determined socketAddress loaded from SharedPreferences
            socket = IO.socket(socketAddress)
            socket.connect()

            // ... (rest of Socket.IO setup for DownloadsActivity, e.g., on "new_download_ready") ...
            socket.on("new_download_ready") { args ->
                if (args.isNotEmpty() && args[0] is JSONObject) { // Expecting a JSONObject
                    val data = args[0] as JSONObject
                    try {
                        val fileName = data.getString("fileName")
                        val downloadLink = data.getString("downloadLink")
                        onDownloadLinkReceived(fileName, downloadLink)
                    } catch (e: JSONException) {
                        Log.e(TAG, "JSON parsing error for download link: ${e.message}", e)
                    }
                } else {
                    Log.e(TAG, "Received Socket.IO message with unexpected format: ${args.joinToString()}")
                }
            }
            socket.on(Socket.EVENT_CONNECT) { Log.d(TAG, "Socket.IO Connected!") }
            socket.on(Socket.EVENT_DISCONNECT) { Log.d(TAG, "Socket.IO Disconnected!") }
            socket.on(Socket.EVENT_CONNECT_ERROR) { args ->
                Log.e(TAG, "Socket.IO Connect Error: ${args.joinToString()}")
                runOnUiThread {
                    Toast.makeText(this, "Socket.IO connection error to $socketAddress.", Toast.LENGTH_LONG).show()
                }
            }

        } catch (e: Exception) {
            Log.e(TAG, "Error setting up Socket.IO for $socketAddress: ${e.message}", e)
            runOnUiThread {
                Toast.makeText(this, "Failed to initialize server connection.", Toast.LENGTH_LONG).show()
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        socket.disconnect()
        socket.off("new_download_ready")
    }

    private fun addNewDownloadLink(fileName: String, downloadLink: String) {
        val newItem = DownloadItem(fileName, downloadLink)
        downloadFilesAdapter.addDownloadItem(newItem)
    }

    private fun onDownloadLinkReceived(fileName: String, downloadLink: String) {
        runOnUiThread {
            addNewDownloadLink(fileName, downloadLink)
        }
    }

    // --- Permissions and Download Logic ---
    private fun checkAndRequestPermissions(fileName: String, downloadLink: String) {
        // For Android 9 (API 28) and below
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE)
                != PackageManager.PERMISSION_GRANTED) {
                // Request permission if not granted
                ActivityCompat.requestPermissions(this,
                    arrayOf(Manifest.permission.WRITE_EXTERNAL_STORAGE),
                    STORAGE_PERMISSION_CODE)
                // IMPORTANT: If permission is not granted immediately, you'll need a way
                // to re-trigger this specific download after the user grants permission.
                // You might store the fileName and downloadLink in a ViewModel or
                // temporary class properties.
            } else {
                // Permission already granted, proceed with download
                startDownload(fileName, downloadLink)
            }
        } else {
            // Android 10 (API 29) and above: No explicit WRITE_EXTERNAL_STORAGE needed for MediaStore.Downloads
            // MediaStore handles permissions internally based on its APIs.
            startDownload(fileName, downloadLink)
        }
    }

    // Handles the result of the permission request
    override fun onRequestPermissionsResult(requestCode: Int,
                                            permissions: Array<String>,
                                            grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == STORAGE_PERMISSION_CODE) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                Toast.makeText(this, "Storage Permission Granted. Tap download again.", Toast.LENGTH_SHORT).show()
                // Do NOT call startDownload here directly.
                // The user needs to tap the download button again, or you need to
                // store the last attempted download item and re-initiate it.
            } else {
                Toast.makeText(this, "Storage Permission Denied. Cannot save file.", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun startDownload(fileName: String, downloadLink: String) {
        Toast.makeText(this, "Initiating download for '$fileName'...", Toast.LENGTH_SHORT).show()
        Log.d(TAG, "Attempting to download from: $downloadLink")

        GlobalScope.launch(Dispatchers.IO) { // Perform network operations on a background thread
            val client = OkHttpClient()
            val request = Request.Builder().url(downloadLink).build()

            try {
                client.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) {
                        val errorMessage = "Download failed: ${response.code} - ${response.message}"
                        Log.e(TAG, errorMessage)
                        launch(Dispatchers.Main) { Toast.makeText(this@DownloadsActivity, errorMessage, Toast.LENGTH_LONG).show() }
                        return@launch
                    }

                    // Use MediaStore for Android 10+ for public Downloads folder access
                    val contentValues = ContentValues().apply {
                        put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                        put(MediaStore.MediaColumns.MIME_TYPE, "application/zip") // Or determine based on file extension
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
                                Toast.makeText(this@DownloadsActivity, "Download complete: $fileName", Toast.LENGTH_LONG).show()
                            }
                            Log.d(TAG, "File downloaded to: $insertedUri")
                        } ?: run {
                            throw Exception("Failed to create new MediaStore entry for $fileName")
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Error saving file via MediaStore: ${e.message}", e)
                        // Clean up partially created entry if save fails
                        uri?.let { contentResolver.delete(it, null, null) }
                        launch(Dispatchers.Main) {
                            Toast.makeText(this@DownloadsActivity, "Error saving file: ${e.message}", Toast.LENGTH_LONG).show()
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Network error during download: ${e.message}", e)
                launch(Dispatchers.Main) { Toast.makeText(this@DownloadsActivity, "Network error: ${e.message}", Toast.LENGTH_LONG).show() }
            }
        }
    }
}
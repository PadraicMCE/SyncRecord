package com.mcevoy.syncrecordapp

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import java.io.File

class DownloadsActivity : AppCompatActivity() {

    private lateinit var downloadFilesRecyclerView: RecyclerView
    private lateinit var downloadFilesAdapter: DownloadFilesAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_downloads)

        downloadFilesRecyclerView = findViewById(R.id.downloadFilesRecyclerView)
        downloadFilesRecyclerView.layoutManager = LinearLayoutManager(this)

        downloadFilesAdapter = DownloadFilesAdapter(mutableListOf())
        downloadFilesRecyclerView.adapter = downloadFilesAdapter

        // Populate the adapter with download files
        val downloadFiles = getDownloadFiles()
        val downloadItems = downloadFiles.map { file -> DownloadItem(file.name, file.toString()) }
        downloadItems.forEach { item ->
            downloadFilesAdapter.addDownloadItem(item)
        }
    }

    private fun getDownloadFiles(): List<File> {
        val downloadsDir = getExternalFilesDir(null) // or specify subdirectory
        return downloadsDir?.listFiles()?.toList() ?: emptyList()
    }
}

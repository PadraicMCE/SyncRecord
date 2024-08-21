package com.mcevoy.syncrecordapp

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import java.io.File

class DownloadFilesAdapter(private var downloadItems: MutableList<DownloadItem>) : RecyclerView.Adapter<DownloadFilesAdapter.FileViewHolder>() {

    class FileViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val fileNameTextView: TextView = itemView.findViewById(R.id.fileNameTextView)
        val downloadButton: Button = itemView.findViewById(R.id.downloadButton)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): FileViewHolder {
        val itemView = LayoutInflater.from(parent.context).inflate(R.layout.item_download, parent, false)
        return FileViewHolder(itemView)
    }

    override fun onBindViewHolder(holder: FileViewHolder, position: Int) {
        val downloadItem = downloadItems[position]
        holder.fileNameTextView.text = downloadItem.fileName
        holder.downloadButton.setOnClickListener {
            // Handle the download action here, e.g., open the file or start a download
        }
    }

    override fun getItemCount(): Int {
        return downloadItems.size
    }

    fun addDownloadItem(newItem: DownloadItem) {
        downloadItems.add(newItem)
        notifyItemInserted(downloadItems.size - 1)
    }
}

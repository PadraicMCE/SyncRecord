package com.mcevoy.syncrecordapp

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
// No longer need java.io.File here, as it's handled by the Activity
// import java.io.File // This line can be removed as it's not directly used in the adapter for now

// Assuming DownloadItem data class is defined in a separate file or accessible in this package
// data class DownloadItem(val fileName: String, val downloadLink: String)

class DownloadFilesAdapter(
    private var downloadItems: MutableList<DownloadItem>,
    // THIS IS THE CRUCIAL CHANGE: Add the lambda function to the constructor
    private val onItemClicked: (DownloadItem) -> Unit
) : RecyclerView.Adapter<DownloadFilesAdapter.FileViewHolder>() {

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
            // THIS IS THE OTHER CRUCIAL CHANGE: Call the lambda when the button is clicked
            onItemClicked(downloadItem)
        }
    }

    override fun getItemCount(): Int {
        return downloadItems.size
    }

    fun addDownloadItem(newItem: DownloadItem) {
        downloadItems.add(newItem)
        notifyItemInserted(downloadItems.size - 1)
        // If you were adding multiple items, you might use notifyDataSetChanged()
        // but notifyItemInserted is more efficient for single additions.
    }
}
package com.modium.browser.download

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.modium.browser.R
import kotlin.math.roundToInt

class DownloadFormatsAdapter(
    private val formats: List<DownloadFormat>,
    private val onPick: (DownloadFormat) -> Unit
) : RecyclerView.Adapter<DownloadFormatsAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val label: TextView = view.findViewById(R.id.textFormatLabel)
        val meta: TextView = view.findViewById(R.id.textFormatMeta)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_download_format, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val format = formats[position]
        holder.label.text = format.label
        holder.meta.text = buildString {
            append(format.ext.uppercase())
            if (format.filesizeBytes > 0) {
                append(" · ")
                append(formatSize(format.filesizeBytes))
            }
        }
        holder.itemView.setOnClickListener { onPick(format) }
    }

    override fun getItemCount(): Int = formats.size

    private fun formatSize(bytes: Long): String {
        val mb = bytes / 1024.0 / 1024.0
        return if (mb >= 1024) {
            "%.1f GB".format(mb / 1024.0)
        } else {
            "${(mb * 10).roundToInt() / 10.0} MB"
        }
    }
}

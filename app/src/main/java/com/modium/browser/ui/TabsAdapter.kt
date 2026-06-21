package com.modium.browser.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.modium.browser.R
import com.modium.browser.data.Tab

class TabsAdapter(
    private val tabs: MutableList<Tab>,
    private val onTabClick: (Tab) -> Unit,
    private val onTabClose: (Tab) -> Unit
) : RecyclerView.Adapter<TabsAdapter.TabViewHolder>() {

    class TabViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val title: android.widget.TextView = view.findViewById(R.id.tabTitle)
        val url: android.widget.TextView = view.findViewById(R.id.tabUrl)
        val closeBtn: android.widget.ImageButton = view.findViewById(R.id.btnCloseTab)
        val privateIcon: android.widget.ImageView = view.findViewById(R.id.tabPrivateIcon)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): TabViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_tab, parent, false)
        return TabViewHolder(view)
    }

    override fun onBindViewHolder(holder: TabViewHolder, position: Int) {
        val tab = tabs[position]
        holder.title.text = tab.title.ifBlank { "New tab" }
        holder.url.text = tab.url
        holder.privateIcon.visibility = if (tab.isPrivate) View.VISIBLE else View.GONE
        holder.itemView.setOnClickListener { onTabClick(tab) }
        holder.closeBtn.setOnClickListener { onTabClose(tab) }
    }

    override fun getItemCount() = tabs.size

    fun updateTabs(newTabs: List<Tab>) {
        tabs.clear()
        tabs.addAll(newTabs)
        notifyDataSetChanged()
    }
}

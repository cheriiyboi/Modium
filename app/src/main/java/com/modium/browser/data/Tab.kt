package com.modium.browser.data

import java.util.UUID

data class Tab(
    val id: String = UUID.randomUUID().toString(),
    var title: String = "New tab",
    var url: String = "modium://newtab",
    var isPrivate: Boolean = false,
    var blockedCount: Int = 0,
    var isDesktopMode: Boolean = false,
    var favicon: android.graphics.Bitmap? = null
)

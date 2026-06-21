package com.modium.browser

import android.app.Application
import com.modium.browser.blocker.FilterListManager
import com.modium.browser.download.DownloadEngine

class ModiumApp : Application() {

    override fun onCreate() {
        super.onCreate()
        FilterListManager.preload(this)
        DownloadEngine.ensureStarted(this)
    }
}

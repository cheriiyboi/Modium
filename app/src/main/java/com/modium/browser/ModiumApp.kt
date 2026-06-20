package com.modium.browser

import android.app.Application
import com.modium.browser.blocker.FilterListManager

class ModiumApp : Application() {

    override fun onCreate() {
        super.onCreate()
        FilterListManager.preload(this)
    }
}

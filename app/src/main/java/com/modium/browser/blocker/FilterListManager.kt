package com.modium.browser.blocker

import android.content.Context
import android.net.Uri
import java.io.BufferedReader
import java.io.InputStreamReader

/**
 * Lightweight ad/tracker blocking engine.
 * Loads a built-in list of known ad/tracker domains (EasyList/EasyPrivacy-derived host snapshot)
 * bundled as a raw asset, and does O(1) suffix matching against the request host.
 */
object FilterListManager {

    private val blockedHosts = HashSet<String>(4096)
    private val blockedHostSuffixes = ArrayList<String>(64)
    @Volatile private var loaded = false

    fun preload(context: Context) {
        if (loaded) return
        synchronized(this) {
            if (loaded) return
            try {
                context.assets.open("blocklist.txt").use { input ->
                    BufferedReader(InputStreamReader(input)).forEachLine { rawLine ->
                        val line = rawLine.trim()
                        if (line.isEmpty() || line.startsWith("#")) return@forEachLine
                        blockedHosts.add(line)
                    }
                }
            } catch (e: Exception) {
                // Asset missing or unreadable: fall back to the minimal built-in set only.
            }
            blockedHosts.addAll(BUILTIN_FALLBACK)
            loaded = true
        }
    }

    /**
     * Returns true if the given request URL should be blocked.
     */
    fun shouldBlock(context: Context, url: String, adsTrackersEnabled: Boolean): Boolean {
        if (!adsTrackersEnabled) return false
        if (!loaded) preload(context)

        val host = try {
            Uri.parse(url).host?.lowercase()
        } catch (e: Exception) {
            null
        } ?: return false

        if (blockedHosts.contains(host)) return true

        // Check registrable-domain suffix match, e.g. "ads.example.com" matches "example.com"
        var idx = host.indexOf('.')
        while (idx != -1) {
            val candidate = host.substring(idx + 1)
            if (blockedHosts.contains(candidate)) return true
            idx = host.indexOf('.', idx + 1)
        }

        return false
    }

    fun isTrackerScript(url: String): Boolean {
        val lower = url.lowercase()
        return TRACKER_PATH_HINTS.any { lower.contains(it) }
    }

    private val TRACKER_PATH_HINTS = listOf(
        "/analytics.js", "/gtag/js", "/fbevents.js", "/pixel.js", "ga.js",
        "doubleclick", "googlesyndication", "google-analytics"
    )

    // Minimal built-in fallback if blocklist.txt asset isn't present, so blocking still
    // does *something* useful out of the box.
    private val BUILTIN_FALLBACK = setOf(
        "doubleclick.net", "googlesyndication.com", "googleadservices.com",
        "google-analytics.com", "googletagmanager.com", "googletagservices.com",
        "adservice.google.com", "adnxs.com", "facebook.net", "connect.facebook.net",
        "scorecardresearch.com", "quantserve.com", "outbrain.com", "taboola.com",
        "criteo.com", "criteo.net", "moatads.com", "amazon-adsystem.com",
        "adsrvr.org", "rubiconproject.com", "pubmatic.com", "openx.net",
        "casalemedia.com", "bluekai.com", "mathtag.com", "media.net",
        "yieldmo.com", "33across.com", "smartadserver.com", "advertising.com",
        "adform.net", "adroll.com", "branch.io", "appsflyer.com",
        "mixpanel.com", "segment.io", "segment.com", "hotjar.com",
        "fullstory.com", "crazyegg.com", "mouseflow.com", "yandex.ru/metrika",
        "newrelic.com", "nr-data.net", "sentry.io", "bugsnag.com",
        "chartbeat.com", "comscore.com", "krxd.net", "demdex.net",
        "everesttech.net", "turn.com", "tapad.com", "exelator.com",
        "adtechus.com", "serving-sys.com", "flashtalking.com",
        "innovid.com", "spotxchange.com", "tremorhub.com", "indexexchange.com",
        "sharethrough.com", "triplelift.com", "gumgum.com", "sovrn.com",
        "loopme.com", "smaato.net", "vungle.com", "applovin.com",
        "ironsrc.com", "unityads.unity3d.com", "chartboost.com"
    )
}

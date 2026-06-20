package com.modium.browser.data

import android.content.Context
import androidx.preference.PreferenceManager

object Settings {

    private const val KEY_BLOCK_ADS = "pref_block_ads"
    private const val KEY_HTTPS_UPGRADE = "pref_https_upgrade"
    private const val KEY_BLOCK_POPUPS = "pref_block_popups"
    private const val KEY_BLOCK_3P_COOKIES = "pref_block_3p_cookies"
    private const val KEY_DO_NOT_TRACK = "pref_do_not_track"
    private const val KEY_SAVE_PASSWORDS = "pref_save_passwords"
    private const val KEY_SEARCH_ENGINE = "pref_search_engine"
    private const val KEY_HOME_PAGE = "pref_home_page"
    private const val KEY_DESKTOP_DEFAULT = "pref_desktop_default"
    private const val KEY_BLOCK_FINGERPRINT = "pref_block_fingerprint"

    fun blockAds(context: Context) = prefs(context).getBoolean(KEY_BLOCK_ADS, true)
    fun setBlockAds(context: Context, value: Boolean) = prefs(context).edit().putBoolean(KEY_BLOCK_ADS, value).apply()

    fun httpsUpgrade(context: Context) = prefs(context).getBoolean(KEY_HTTPS_UPGRADE, true)
    fun setHttpsUpgrade(context: Context, value: Boolean) = prefs(context).edit().putBoolean(KEY_HTTPS_UPGRADE, value).apply()

    fun blockPopups(context: Context) = prefs(context).getBoolean(KEY_BLOCK_POPUPS, true)
    fun setBlockPopups(context: Context, value: Boolean) = prefs(context).edit().putBoolean(KEY_BLOCK_POPUPS, value).apply()

    fun blockThirdPartyCookies(context: Context) = prefs(context).getBoolean(KEY_BLOCK_3P_COOKIES, true)

    fun blockFingerprinting(context: Context) = prefs(context).getBoolean(KEY_BLOCK_FINGERPRINT, true)
    fun setBlockFingerprinting(context: Context, value: Boolean) = prefs(context).edit().putBoolean(KEY_BLOCK_FINGERPRINT, value).apply()

    fun doNotTrack(context: Context) = prefs(context).getBoolean(KEY_DO_NOT_TRACK, false)

    fun savePasswords(context: Context) = prefs(context).getBoolean(KEY_SAVE_PASSWORDS, true)

    fun searchEngine(context: Context) = prefs(context).getString(KEY_SEARCH_ENGINE, "duckduckgo") ?: "duckduckgo"

    fun homePage(context: Context) = prefs(context).getString(KEY_HOME_PAGE, "https://duckduckgo.com") ?: "https://duckduckgo.com"

    fun desktopDefault(context: Context) = prefs(context).getBoolean(KEY_DESKTOP_DEFAULT, false)

    fun shieldsGloballyEnabled(context: Context) = prefs(context).getBoolean("pref_shields_global", true)
    fun setShieldsGloballyEnabled(context: Context, value: Boolean) = prefs(context).edit().putBoolean("pref_shields_global", value).apply()

    fun searchUrlFor(context: Context, query: String): String {
        val encoded = java.net.URLEncoder.encode(query, "UTF-8")
        return when (searchEngine(context)) {
            "google" -> "https://www.google.com/search?q=$encoded"
            "bing" -> "https://www.bing.com/search?q=$encoded"
            "startpage" -> "https://www.startpage.com/sp/search?query=$encoded"
            "brave" -> "https://search.brave.com/search?q=$encoded"
            else -> "https://duckduckgo.com/?q=$encoded"
        }
    }

    private fun prefs(context: Context) = PreferenceManager.getDefaultSharedPreferences(context)
}

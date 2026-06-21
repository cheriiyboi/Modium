"""
Bridge between Kotlin and yt-dlp, run in-process via Chaquopy.

Kotlin calls these two functions through Python.getInstance().getModule("downloader").
`download()` takes a Kotlin object (passed straight through as a Java object) and calls
its public methods directly -- Chaquopy lets Python call Java/Kotlin objects passed in
as arguments, so no extra glue is needed on either side.
"""

import yt_dlp


def get_info(url):
    """Resolve a page URL into a title + list of downloadable formats, no download yet."""
    opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": True,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)

    formats = []
    for f in info.get("formats", []):
        # Skip entries with neither audio nor video (e.g. storyboard thumbnails).
        if f.get("vcodec") == "none" and f.get("acodec") == "none":
            continue
        is_audio_only = f.get("vcodec") == "none"
        height = f.get("height")
        label = "Audio only" if is_audio_only else (f"{height}p" if height else f.get("format_note", f.get("ext", "")))
        formats.append({
            "format_id": f.get("format_id", ""),
            "ext": f.get("ext", ""),
            "label": label,
            "filesize": f.get("filesize") or f.get("filesize_approx") or 0,
            "is_audio_only": is_audio_only,
        })

    return {
        "title": info.get("title") or url,
        "thumbnail": info.get("thumbnail") or "",
        "duration": info.get("duration") or 0,
        "formats": formats,
    }


def download(url, format_id, output_dir, callback):
    """Download `format_id` from `url` into `output_dir`, reporting progress to `callback`."""

    def hook(d):
        status = d.get("status")
        if status == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            downloaded = d.get("downloaded_bytes") or 0
            percent = (downloaded * 100.0 / total) if total else -1.0
            speed = d.get("speed") or 0
            eta = d.get("eta") or 0
            callback.onProgress(percent, int(eta), int(speed))
        elif status == "error":
            callback.onError("yt-dlp reported an error during download")

    opts = {
        "format": format_id,
        "outtmpl": output_dir + "/%(title).200B [%(id)s].%(ext)s",
        "progress_hooks": [hook],
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
    }

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)
        callback.onComplete(filename)
    except Exception as exc:  # noqa: BLE001 - surface any failure back to Kotlin
        callback.onError(str(exc))

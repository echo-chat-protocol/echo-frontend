// Copyright 2019-2023 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

package app.tauri.notification

import android.content.ContentResolver
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import app.tauri.annotation.InvokeArg
import java.net.URL
import app.tauri.plugin.JSArray
import app.tauri.plugin.JSObject
import org.json.JSONException
import org.json.JSONObject

@InvokeArg
class Notification {
  var id: Int = 0
  var title: String? = null
  var body: String? = null
  var largeBody: String? = null
  var summary: String? = null
  var sound: String? = null
  var icon: String? = null
  var largeIcon: String? = null
  var iconColor: String? = null
  var actionTypeId: String? = null
  var group: String? = null
  var inboxLines: List<String>? = null
  var isGroupSummary = false
  var isOngoing = false
  var isAutoCancel = false
  var extra: JSObject? = null
  var attachments: List<NotificationAttachment>? = null
  var schedule: NotificationSchedule? = null
  var channelId: String? = null
  var sourceJson: String? = null
  var visibility: Int? = null
  var number: Int? = null

  fun getSound(context: Context, defaultSound: Int): String? {
    var soundPath: String? = null
    var resId: Int = AssetUtils.RESOURCE_ID_ZERO_VALUE
    val name = AssetUtils.getResourceBaseName(sound)
    if (name != null) {
      resId = AssetUtils.getResourceID(context, name, "raw")
    }
    if (resId == AssetUtils.RESOURCE_ID_ZERO_VALUE) {
      resId = defaultSound
    }
    if (resId != AssetUtils.RESOURCE_ID_ZERO_VALUE) {
      soundPath =
        ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + context.packageName + "/" + resId
    }
    return soundPath
  }

  fun getIconColor(globalColor: String): String {
    // use the one defined local before trying for a globally defined color
    return iconColor ?: globalColor
  }

  fun getSmallIcon(context: Context, defaultIcon: Int): Int {
    var resId: Int = AssetUtils.RESOURCE_ID_ZERO_VALUE
    if (icon != null) {
      resId = AssetUtils.getResourceID(context, icon, "drawable")
    }
    if (resId == AssetUtils.RESOURCE_ID_ZERO_VALUE) {
      resId = defaultIcon
    }
    return resId
  }

  fun getLargeIcon(context: Context): Bitmap? {
    val li = largeIcon ?: return null
    // Allow a runtime image (e.g. a sender's profile picture staged to a file)
    // in addition to a bundled drawable resource name.
    if (li.startsWith("data:") || li.startsWith("file://") || li.startsWith("/") || li.startsWith("content://") || li.startsWith("http://") || li.startsWith("https://")) {
      return decodeAttachmentBitmap(context, li)
    }
    val resId: Int = AssetUtils.getResourceID(context, li, "drawable")
    if (resId == AssetUtils.RESOURCE_ID_ZERO_VALUE) return null
    return BitmapFactory.decodeResource(context.resources, resId)
  }

  // Decode the first usable image attachment into a Bitmap for BigPictureStyle.
  // Accepts file:// paths, absolute paths and content:// URIs. Returns null when
  // there is no attachment or it can't be decoded.
  fun getBigPicture(context: Context): Bitmap? {
    val list = attachments ?: return null
    for (att in list) {
      val url = att.url ?: continue
      val bmp = decodeAttachmentBitmap(context, url)
      if (bmp != null) return bmp
    }
    return null
  }

  private fun decodeAttachmentBitmap(context: Context, url: String): Bitmap? {
    return try {
      val input: java.io.InputStream? = when {
        url.startsWith("data:") -> {
          // Decode data URLs (e.g., avatars staged from JS via fetch→base64) to avoid
          // Java-side network IO on the UI thread and CORS concerns.
          val comma = url.indexOf(',')
          if (comma <= 0) return null
          val base64 = url.substring(comma + 1)
          val bytes = android.util.Base64.decode(base64, android.util.Base64.DEFAULT)
          return decodeBoundedBitmap(bytes)
        }
        url.startsWith("file://") -> {
          val path = android.net.Uri.parse(url).path ?: return null
          java.io.FileInputStream(path)
        }
        url.startsWith("/") -> java.io.FileInputStream(url)
        url.startsWith("http://") || url.startsWith("https://") -> URL(url).openStream()
        else -> context.contentResolver.openInputStream(android.net.Uri.parse(url))
      }
      input?.use { stream ->
        val bytes = stream.readBytes()
        decodeBoundedBitmap(bytes)
      }
    } catch (e: Exception) {
      null
    }
  }

  // Two-pass decode so a large image can't OOM the notification process. Android
  // scales the big picture down anyway, so a ~1024px max edge is plenty.
  private fun decodeBoundedBitmap(bytes: ByteArray, maxDim: Int = 1024): Bitmap? {
    if (bytes.isEmpty()) return null
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
    val w = bounds.outWidth
    val h = bounds.outHeight
    if (w <= 0 || h <= 0) return null
    var sample = 1
    while (w / sample > maxDim || h / sample > maxDim) sample *= 2
    val opts = BitmapFactory.Options().apply { inSampleSize = sample }
    return BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts)
  }

  companion object {
    fun buildNotificationPendingList(notifications: List<Notification>): List<PendingNotification> {
      val pendingNotifications = mutableListOf<PendingNotification>()
      for (notification in notifications) {
        val pendingNotification = PendingNotification(notification.id, notification.title, notification.body, notification.schedule, notification.extra)
        pendingNotifications.add(pendingNotification)
      }
      return pendingNotifications
    }
  }
}

class PendingNotification(val id: Int, val title: String?, val body: String?, val schedule: NotificationSchedule?, val extra: JSObject?)

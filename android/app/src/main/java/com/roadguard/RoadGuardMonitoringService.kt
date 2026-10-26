package com.roadguard

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.IBinder
import android.os.Looper
import androidx.core.content.ContextCompat
import org.json.JSONArray

class RoadGuardMonitoringService : Service(), LocationListener {
  private data class Zone(
    val id: String,
    val name: String,
    val latitude: Double,
    val longitude: Double,
    val demo: Boolean,
  )

  private var zones: List<Zone> = emptyList()
  private var warningDistanceMeters = 500f
  private val insideZoneIds = mutableSetOf<String>()
  private lateinit var locationManager: LocationManager
  private lateinit var notificationManager: NotificationManager

  override fun onCreate() {
    super.onCreate()
    locationManager = getSystemService(LocationManager::class.java)
    notificationManager = getSystemService(NotificationManager::class.java)
    createNotificationChannels()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopSelf()
      return START_NOT_STICKY
    }
    try {
      zones = parseZones(intent?.getStringExtra(EXTRA_ZONES) ?: "[]")
      warningDistanceMeters = (intent?.getFloatExtra(EXTRA_DISTANCE, 500f) ?: 500f)
        .coerceIn(100f, 5000f)
      if (!hasLocationPermission()) {
        stopSelf()
        return START_NOT_STICKY
      }
      startAsForeground()
      getSharedPreferences("roadguard_monitoring", MODE_PRIVATE).edit().putBoolean("active", true).apply()
      locationManager.requestLocationUpdates(
        LocationManager.GPS_PROVIDER,
        LOCATION_INTERVAL_MS,
        LOCATION_DISTANCE_METERS,
        this,
        Looper.getMainLooper(),
      )
    } catch (error: Exception) {
      postNotification(SERVICE_NOTIFICATION_ID, statusNotification("Location monitoring stopped", error.message ?: "Unable to access GPS."))
      stopSelf()
      return START_NOT_STICKY
    }
    return START_NOT_STICKY
  }

  override fun onLocationChanged(location: Location) {
    val currentlyInside = mutableSetOf<String>()
    zones.forEach { zone ->
      val distance = FloatArray(1)
      Location.distanceBetween(location.latitude, location.longitude, zone.latitude, zone.longitude, distance)
      if (distance[0] <= warningDistanceMeters) {
        currentlyInside.add(zone.id)
        if (insideZoneIds.add(zone.id)) {
          val label = if (zone.demo) "Demo area (not official)" else zone.name
          postNotification(zone.id.hashCode(), alertNotification(label, zone.demo))
        }
      }
    }
    insideZoneIds.retainAll(currentlyInside)
  }

  override fun onProviderDisabled(provider: String) {
    if (provider == LocationManager.GPS_PROVIDER) {
      postNotification(SERVICE_NOTIFICATION_ID, statusNotification("GPS unavailable", "Background proximity alerts are paused until GPS is available."))
    }
  }

  override fun onProviderEnabled(provider: String) = Unit
  override fun onStatusChanged(provider: String?, status: Int, extras: android.os.Bundle?) = Unit

  override fun onDestroy() {
    try { locationManager.removeUpdates(this) } catch (_: Exception) { }
    getSharedPreferences("roadguard_monitoring", MODE_PRIVATE).edit().putBoolean("active", false).apply()
    if (::notificationManager.isInitialized) notificationManager.cancel(SERVICE_NOTIFICATION_ID)
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun hasLocationPermission(): Boolean =
    ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
      ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

  private fun parseZones(json: String): List<Zone> {
    val array = JSONArray(json)
    return (0 until array.length()).mapNotNull { index ->
      val row = array.optJSONObject(index) ?: return@mapNotNull null
      val lat = row.optDouble("latitude", Double.NaN)
      val lon = row.optDouble("longitude", Double.NaN)
      if (!lat.isFinite() || lat !in -90.0..90.0 || !lon.isFinite() || lon !in -180.0..180.0) return@mapNotNull null
      Zone(
        id = row.optString("id"),
        name = row.optString("name", "RoadGuard area"),
        latitude = lat,
        longitude = lon,
        demo = row.optBoolean("demo", true),
      ).takeIf { it.id.isNotBlank() }
    }
  }

  private fun createNotificationChannels() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      notificationManager.createNotificationChannel(NotificationChannel(SERVICE_CHANNEL, "RoadGuard background monitoring", NotificationManager.IMPORTANCE_LOW).apply {
        description = "Visible notification while RoadGuard checks configured proximity areas."
      })
      notificationManager.createNotificationChannel(NotificationChannel(ALERT_CHANNEL, "RoadGuard proximity alerts", NotificationManager.IMPORTANCE_DEFAULT).apply {
        description = "One alert when entering a configured RoadGuard warning area."
      })
    }
  }

  private fun startAsForeground() {
    val notification = statusNotification("RoadGuard monitoring is active", "Location stays on this device. Tap to stop monitoring in RoadGuard settings.")
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(SERVICE_NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
    } else {
      startForeground(SERVICE_NOTIFICATION_ID, notification)
    }
  }

  private fun postNotification(id: Int, notification: Notification) {
    try { notificationManager.notify(id, notification) } catch (_: SecurityException) { }
  }

  private fun statusNotification(title: String, message: String): Notification =
    buildNotification(SERVICE_CHANNEL, title, message, Notification.PRIORITY_LOW, false)

  private fun alertNotification(zoneName: String, demo: Boolean): Notification =
    buildNotification(ALERT_CHANNEL, if (demo) "Demo proximity alert" else "RoadGuard proximity alert", "$zoneName. Warning distance: ${warningDistanceMeters.toInt()} metres.", Notification.PRIORITY_DEFAULT, true)

  private fun buildNotification(channel: String, title: String, message: String, priority: Int, autoCancel: Boolean): Notification {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    val pendingIntent = launchIntent?.let {
      PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_UPDATE_CURRENT or if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
    }
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, channel) else Notification.Builder(this)
    builder.setSmallIcon(android.R.drawable.ic_menu_mylocation)
      .setContentTitle(title)
      .setContentText(message)
      .setStyle(Notification.BigTextStyle().bigText(message))
      .setPriority(priority)
      .setAutoCancel(autoCancel)
      .setOngoing(!autoCancel)
    if (pendingIntent != null) builder.setContentIntent(pendingIntent)
    return builder.build()
  }

  companion object {
    const val ACTION_START = "com.roadguard.action.START_MONITORING"
    const val ACTION_STOP = "com.roadguard.action.STOP_MONITORING"
    const val EXTRA_ZONES = "roadguard.zones"
    const val EXTRA_DISTANCE = "roadguard.distance"
    private const val SERVICE_CHANNEL = "roadguard-monitoring"
    private const val ALERT_CHANNEL = "roadguard-alerts"
    private const val SERVICE_NOTIFICATION_ID = 8101
    private const val LOCATION_INTERVAL_MS = 5000L
    private const val LOCATION_DISTANCE_METERS = 15f
  }
}

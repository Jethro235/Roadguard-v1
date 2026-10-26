package com.roadguard

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class RoadGuardMonitoringModule(context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {
  override fun getName(): String = "RoadGuardMonitoring"

  @ReactMethod
  fun startMonitoring(zonesJson: String, warningDistanceMeters: Double, promise: Promise) {
    try {
      val intent = Intent(reactApplicationContext, RoadGuardMonitoringService::class.java).apply {
        action = RoadGuardMonitoringService.ACTION_START
        putExtra(RoadGuardMonitoringService.EXTRA_ZONES, zonesJson)
        putExtra(RoadGuardMonitoringService.EXTRA_DISTANCE, warningDistanceMeters.toFloat())
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        reactApplicationContext.startForegroundService(intent)
      } else {
        reactApplicationContext.startService(intent)
      }
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("MONITOR_START_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun stopMonitoring(promise: Promise) {
    try {
      val intent = Intent(reactApplicationContext, RoadGuardMonitoringService::class.java)
      reactApplicationContext.stopService(intent)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("MONITOR_STOP_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun isMonitoring(promise: Promise) {
    val active = reactApplicationContext
      .getSharedPreferences("roadguard_monitoring", android.content.Context.MODE_PRIVATE)
      .getBoolean("active", false)
    promise.resolve(active)
  }
}

#include "Telemetry.h"

#include <WiFi.h>

#include "ConfigStore.h"
#include "config.h"
#include "sensors/Sensors.h"

namespace {

void putFloatOrNull(JsonObject obj, const char* key, float value) {
  if (isnan(value)) {
    obj[key] = nullptr;
  } else {
    obj[key] = value;
  }
}

}  // namespace

namespace telemetry {

String ipAddress() {
  if (WiFi.status() == WL_CONNECTED) return WiFi.localIP().toString();
  if (WiFi.getMode() & WIFI_MODE_AP) return WiFi.softAPIP().toString();
  return "0.0.0.0";
}

String wifiStatus() {
  if (WiFi.status() == WL_CONNECTED) return "sta";
  if (WiFi.getMode() & WIFI_MODE_AP) return "ap";
  return "off";
}

int rssi() { return WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0; }

void build(JsonDocument& doc, const Sensors& sensors, const ConfigStore& config) {
  doc["ts"] = millis();
  doc["uptime"] = static_cast<uint32_t>(millis() / 1000UL);

  JsonObject wifi = doc["wifi"].to<JsonObject>();
  wifi["connected"] = WiFi.status() == WL_CONNECTED;
  wifi["mode"] = wifiStatus();
  wifi["ssid"] = WiFi.status() == WL_CONNECTED ? WiFi.SSID() : String(cfg::AP_SSID);
  wifi["ip"] = ipAddress();
  wifi["rssi"] = rssi();

  const float levelCm = sensors.levelCm();
  const float percent = sensors.levelPercent();
  JsonObject level = doc["level"].to<JsonObject>();
  level["ok"] = sensors.level().ok() && !isnan(percent);
  putFloatOrNull(level, "distanceCm", sensors.level().distanceCm());
  putFloatOrNull(level, "levelCm", levelCm);
  putFloatOrNull(level, "percent", percent);
  putFloatOrNull(level, "liters", sensors.liters());
  level["tankHeightCm"] = config.tankHeightCm();
  level["maxLevelCm"] = config.maxLevelCm();

  JsonObject flow = doc["flow"].to<JsonObject>();
  flow["ok"] = sensors.flow().ok();
  flow["lpm"] = sensors.flow().litersPerMinute();
  flow["totalL"] = sensors.flow().totalLiters();
  flow["pulses"] = sensors.flow().totalPulses();

  JsonObject temperature = doc["temperature"].to<JsonObject>();
  temperature["ok"] = sensors.temperature().ok();
  putFloatOrNull(temperature, "c", sensors.temperature().celsius());

  JsonObject ph = doc["ph"].to<JsonObject>();
  ph["ok"] = sensors.ph().ok();
  putFloatOrNull(ph, "value", sensors.ph().ph());
  putFloatOrNull(ph, "voltage", sensors.ph().voltage());
  ph["raw"] = sensors.ph().raw();

  JsonObject turbidity = doc["turbidity"].to<JsonObject>();
  turbidity["ok"] = sensors.turbidity().ok();
  putFloatOrNull(turbidity, "ntu", sensors.turbidity().ntu());
  putFloatOrNull(turbidity, "clarity", sensors.turbidity().clarityPercent());
  putFloatOrNull(turbidity, "voltage", sensors.turbidity().voltage());
  turbidity["raw"] = sensors.turbidity().raw();

  JsonObject system = doc["system"].to<JsonObject>();
  system["heap"] = ESP.getFreeHeap();
  system["sensorsOk"] = sensors.okCount();
  system["sensorsTotal"] = 5;
  system["flowPpl"] = config.flowPulsesPerLiter();
  system["tankLengthCm"] = cfg::TANK_INTERNAL_LENGTH_CM;
  system["tankWidthCm"] = cfg::TANK_INTERNAL_WIDTH_CM;
}

}  // namespace telemetry

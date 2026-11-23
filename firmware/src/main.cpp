#include <Arduino.h>
#include <ESPmDNS.h>
#include <WiFi.h>

#include "ConfigStore.h"
#include "Display.h"
#include "Telemetry.h"
#include "config.h"
#include "secrets.h"
#include "sensors/Sensors.h"
#include "web/WebUI.h"

ConfigStore gConfig;
Sensors gSensors;
Display gDisplay;
WebUI gWeb;

namespace {

bool gApMode = false;
uint32_t gLastWifiAttemptMs = 0;
uint32_t gLastHeartbeatMs = 0;

bool credentialsConfigured() {
  return String(WIFI_SSID) != "TU_RED_WIFI" && strlen(WIFI_SSID) > 0;
}

void startAccessPoint() {
  if (gApMode) return;
  gApMode = true;
  WiFi.mode(WIFI_AP_STA);  // AP para configurar + STA para seguir intentando
  WiFi.softAP(cfg::AP_SSID, cfg::AP_PASS);
  Serial.printf("[wifi] AP de respaldo: %s (http://%s)\n", cfg::AP_SSID,
                WiFi.softAPIP().toString().c_str());
}

void beginStation() {
  if (!credentialsConfigured()) {
    Serial.println("[wifi] sin credenciales en secrets.h -> modo AP");
    startAccessPoint();
    return;
  }

  WiFi.mode(gApMode ? WIFI_AP_STA : WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.setSleep(false);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  gLastWifiAttemptMs = millis();
}

void startMdns() {
  if (!MDNS.begin(cfg::MDNS_HOST)) {
    Serial.println("[mdns] no se pudo iniciar");
    return;
  }
  MDNS.addService("http", "tcp", 80);
  Serial.printf("[mdns] http://%s.local\n", cfg::MDNS_HOST);
}

void connectWifiAtBoot() {
  if (!credentialsConfigured()) {
    startAccessPoint();
    return;
  }

  beginStation();
  Serial.printf("[wifi] conectando a \"%s\"", WIFI_SSID);
  const uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < cfg::WIFI_TIMEOUT_MS) {
    delay(250);
    Serial.print('.');
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[wifi] OK  IP: %s  RSSI: %d dBm\n", WiFi.localIP().toString().c_str(),
                  WiFi.RSSI());
  } else {
    Serial.println("[wifi] no conecto, levantando AP de respaldo");
    startAccessPoint();
  }
}

void wifiWatchdog() {
  const uint32_t now = millis();
  if (WiFi.status() == WL_CONNECTED) return;
  if (now - gLastWifiAttemptMs < cfg::WIFI_RETRY_MS) return;

  gLastWifiAttemptMs = now;
  if (credentialsConfigured()) {
    Serial.println("[wifi] reconectando...");
    WiFi.begin(WIFI_SSID, WIFI_PASS);
  }
  if (!gApMode && now > cfg::WIFI_TIMEOUT_MS + cfg::WIFI_RETRY_MS) startAccessPoint();
}

void heartbeat() {
  const uint32_t now = millis();
  if (now - gLastHeartbeatMs < 10000) return;
  gLastHeartbeatMs = now;

  Serial.printf(
      "[datos] nivel=%.1f%% temp=%.2fC pH=%.2f flujo=%.2fL/min total=%.2fL turb=%.0fNTU "
      "heap=%lu wifi=%s\n",
      gSensors.levelPercent(), gSensors.temperature().celsius(), gSensors.ph().ph(),
      gSensors.flow().litersPerMinute(), gSensors.flow().totalLiters(),
      gSensors.turbidity().ntu(), ESP.getFreeHeap(), telemetry::wifiStatus().c_str());
}

}  // namespace

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println();
  Serial.println("=== Reservorio de Agua - ESP32 ===");

  gConfig.begin();
  gSensors.begin(&gConfig);
  gDisplay.begin();

  connectWifiAtBoot();
  startMdns();

  gWeb.begin(&gSensors, &gConfig);

  Serial.printf("[sistema] heap libre: %lu bytes\n", static_cast<unsigned long>(ESP.getFreeHeap()));
  Serial.println("[sistema] listo");
}

void loop() {
  gSensors.update();
  gDisplay.update(gSensors, gConfig);
  gWeb.loop();
  wifiWatchdog();
  heartbeat();
  delay(2);
}

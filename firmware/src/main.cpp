#include <Arduino.h>
#include <ArduinoOTA.h>
#include <ESPmDNS.h>
#include <LittleFS.h>
#include <WiFi.h>

#include "CloudSync.h"
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

// IP fija opcional (WIFI_STATIC_IP en secrets.h). Sin ella, el router asigna la IP.
void configureStaticIp() {
#ifdef WIFI_STATIC_IP
  IPAddress ip, gateway, subnet, dns;
  if (!ip.fromString(WIFI_STATIC_IP) || !gateway.fromString(WIFI_GATEWAY) ||
      !subnet.fromString(WIFI_SUBNET)) {
    Serial.println("[wifi] IP fija mal escrita en secrets.h -> se usa DHCP");
    return;
  }
#ifdef WIFI_DNS
  if (!dns.fromString(WIFI_DNS)) dns = gateway;
#else
  dns = gateway;
#endif
  if (WiFi.config(ip, gateway, subnet, dns)) {
    Serial.printf("[wifi] IP fija %s\n", WIFI_STATIC_IP);
  } else {
    Serial.println("[wifi] no se pudo fijar la IP -> se usa DHCP");
  }
#endif
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
  configureStaticIp();
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  gLastWifiAttemptMs = millis();
}

void startMdns() {
  if (!MDNS.begin(cfg::MDNS_HOST)) {
    Serial.println("[mdns] no se pudo iniciar");
    return;
  }
  MDNS.addService("http", "tcp", 80);
#ifdef OTA_PASSWORD
  MDNS.enableArduino(cfg::OTA_PORT, true);  // anuncia la actualización por WiFi
#endif
  Serial.printf("[mdns] http://%s.local\n", cfg::MDNS_HOST);
}

// Actualización del firmware y de la web por WiFi (./tools/ota.sh).
void startOta() {
#ifdef OTA_PASSWORD
  ArduinoOTA.setHostname(cfg::MDNS_HOST);
  ArduinoOTA.setPort(cfg::OTA_PORT);
  ArduinoOTA.setPassword(OTA_PASSWORD);
  ArduinoOTA.setMdnsEnabled(false);  // el mDNS ya lo inicia startMdns()
  ArduinoOTA.onStart([]() {
    const bool webFiles = ArduinoOTA.getCommand() == U_SPIFFS;
    if (webFiles) LittleFS.end();  // se va a reescribir la partición de la web
    Serial.printf("[ota] actualizando %s...\n", webFiles ? "archivos web" : "firmware");
  });
  ArduinoOTA.onProgress([](unsigned int done, unsigned int total) {
    static int lastTenth = -1;
    const int tenth = total > 0 ? static_cast<int>(done * 10ULL / total) : 0;
    if (tenth != lastTenth) {
      lastTenth = tenth;
      Serial.printf("[ota] %d%%\n", tenth * 10);
    }
  });
  ArduinoOTA.onEnd([]() { Serial.println("[ota] listo, reiniciando"); });
  ArduinoOTA.onError([](ota_error_t error) { Serial.printf("[ota] error %u\n", error); });
  ArduinoOTA.begin();
  Serial.printf("[ota] actualizacion por WiFi activa (puerto %u)\n", cfg::OTA_PORT);
#else
  Serial.println("[ota] sin OTA_PASSWORD en secrets.h -> actualizacion por WiFi desactivada");
#endif
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
      "[datos] nivel=%.1f%% dist=%.1fcm temp=%.2fC pH=%.2f entra=%.2fL/min(%.2fL) sale=%.2fL/min(%.2fL) turb=%.0fNTU "
      "turbV=%.3fV claridad=%.0f%% heap=%lu wifi=%s nube=%s\n",
      gSensors.levelPercent(), gSensors.level().distanceCm(), gSensors.temperature().celsius(),
      gSensors.ph().ph(),
      gSensors.flowIn().litersPerMinute(), gSensors.flowIn().totalLiters(),
      gSensors.flowOut().litersPerMinute(), gSensors.flowOut().totalLiters(),
      gSensors.turbidity().ntu(), gSensors.turbidity().voltage(),
      gSensors.turbidity().clarityPercent(), ESP.getFreeHeap(), telemetry::wifiStatus().c_str(),
      cloud::status().c_str());
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
  startOta();

  gWeb.begin(&gSensors, &gConfig);
  cloud::begin();

  Serial.printf("[sistema] heap libre: %lu bytes\n", static_cast<unsigned long>(ESP.getFreeHeap()));
  Serial.println("[sistema] listo");
}

void loop() {
#ifdef OTA_PASSWORD
  ArduinoOTA.handle();
#endif
  gSensors.update();
  gDisplay.update(gSensors, gConfig);
  gWeb.loop();
  cloud::loop(gSensors, gConfig);
  wifiWatchdog();
  heartbeat();
  delay(2);
}

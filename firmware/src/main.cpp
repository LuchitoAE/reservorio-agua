#include <Arduino.h>
#include <ArduinoOTA.h>
#include <ESPmDNS.h>
#include <LittleFS.h>
#include <WiFi.h>

#include "CloudSync.h"
#include "ConfigStore.h"
#include "Display.h"
#include "Redes.h"
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

String gRedMostrada = "-";  // para avisar en la LCD cuando cambia la red o la dirección
uint32_t gLastHeartbeatMs = 0;

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

// Muestra en la LCD la red y la dirección al conectarse (o cómo configurar el WiFi).
void avisarRed() {
  const bool ok = WiFi.status() == WL_CONNECTED;
  const String clave = ok ? WiFi.SSID() + " " + WiFi.localIP().toString() : (redes::apActivo() ? "ap" : "");
  if (clave == gRedMostrada) return;
  gRedMostrada = clave;
  if (ok) {
    gDisplay.mensaje("WiFi " + WiFi.SSID(), WiFi.localIP().toString(), 10000);
  } else if (redes::apActivo()) {
    gDisplay.mensaje(cfg::AP_SSID, "Clave reservorio", 8000);
  }
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

  redes::begin(&gConfig);
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
  redes::loop();
  avisarRed();
  heartbeat();
  delay(2);
}

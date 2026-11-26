#include "CloudSync.h"

#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

#include "Telemetry.h"
#include "config.h"
#include "secrets.h"

namespace {

#if defined(CLOUD_URL) && defined(CLOUD_KEY) && defined(CLOUD_TOKEN)
const char* const kUrl = CLOUD_URL;
const char* const kKey = CLOUD_KEY;
const char* const kToken = CLOUD_TOKEN;
#else
const char* const kUrl = "";
const char* const kKey = "";
const char* const kToken = "";
#endif

TaskHandle_t gTask = nullptr;
SemaphoreHandle_t gLock = nullptr;
String gPayload;  // protegido por gLock

volatile int gLastCode = 0;
volatile uint32_t gLastOkMs = 0;
volatile uint32_t gFailures = 0;
uint32_t gLastBuildMs = 0;
uint32_t gLastHistoryMs = 0;
bool gHistoryPending = true;  // el primer envío también va al historial

bool configured() { return strlen(kUrl) > 8 && strlen(kKey) > 8 && strlen(kToken) >= 16; }

void sendTask(void*) {
  WiFiClientSecure client;
  // Sin verificar el certificado del servidor: suficiente en la red de la casa. Para
  // verificarlo habría que incluir el certificado raíz de Supabase (ver docs/nube.md).
  client.setInsecure();
  HTTPClient http;
  http.setReuse(true);  // mantiene la conexión TLS abierta entre envíos
  http.setTimeout(8000);
  const String url = String(kUrl) + "/rest/v1/rpc/ingest";
  const bool jwtKey = strncmp(kKey, "eyJ", 3) == 0;  // clave anon antigua (JWT)

  for (;;) {
    ulTaskNotifyTake(pdTRUE, portMAX_DELAY);
    if (WiFi.status() != WL_CONNECTED) continue;

    String body;
    xSemaphoreTake(gLock, portMAX_DELAY);
    body = gPayload;
    xSemaphoreGive(gLock);
    if (body.isEmpty()) continue;

    if (!http.begin(client, url)) {
      gLastCode = -1;
      gFailures++;
      continue;
    }
    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", kKey);
    if (jwtKey) http.addHeader("Authorization", String("Bearer ") + kKey);

    const int code = http.POST(body);
    gLastCode = code;
    if (code >= 200 && code < 300) {
      if (gLastOkMs == 0) Serial.println("[nube] primer envio OK");
      gLastOkMs = millis();
      gFailures = 0;
    } else {
      gFailures++;
      if (gFailures <= 3 || gFailures % 60 == 0) {
        const String answer = code > 0 ? http.getString().substring(0, 160) : http.errorToString(code);
        Serial.printf("[nube] error %d: %s\n", code, answer.c_str());
      }
      if (code < 0) client.stop();  // conexión rota: la próxima vez se abre una nueva
    }
    http.end();
  }
}

}  // namespace

namespace cloud {

bool enabled() { return gTask != nullptr; }

void begin() {
  if (!configured()) {
    Serial.println("[nube] desactivada (falta CLOUD_URL/CLOUD_KEY/CLOUD_TOKEN en secrets.h)");
    return;
  }
  gLock = xSemaphoreCreateMutex();
  // Núcleo 0 (el del WiFi): el loop de sensores y la web local siguen en el núcleo 1.
  xTaskCreatePinnedToCore(sendTask, "nube", 10240, nullptr, 1, &gTask, 0);
  Serial.printf("[nube] enviando a %s cada %lu s\n", kUrl,
                static_cast<unsigned long>(cfg::CLOUD_INTERVAL_MS / 1000));
}

void loop(const Sensors& sensors, const ConfigStore& config) {
  if (gTask == nullptr) return;
  const uint32_t now = millis();
  if (now - gLastBuildMs < cfg::CLOUD_INTERVAL_MS) return;
  gLastBuildMs = now;
  if (WiFi.status() != WL_CONNECTED) return;

  JsonDocument data;
  telemetry::build(data, sensors, config);
  // La web es pública: no se publican el nombre de la red WiFi ni la IP de la casa.
  data.remove("wifi");
  data["wifi"]["rssi"] = WiFi.RSSI();
  data["wifi"]["connected"] = true;

  if (now - gLastHistoryMs >= cfg::CLOUD_HISTORY_MS) gHistoryPending = true;

  JsonDocument doc;
  doc["p_token"] = kToken;
  doc["p_historial"] = gHistoryPending;
  doc["p_data"] = data;
  if (gHistoryPending) {
    gHistoryPending = false;
    gLastHistoryMs = now;
  }

  String body;
  serializeJson(doc, body);
  xSemaphoreTake(gLock, portMAX_DELAY);
  gPayload = body;
  xSemaphoreGive(gLock);
  xTaskNotifyGive(gTask);
}

String status() {
  if (gTask == nullptr) return "off";
  if (gLastOkMs != 0 && millis() - gLastOkMs < 3 * cfg::CLOUD_INTERVAL_MS) return "ok";
  if (gLastCode == 0) return "esperando";
  return "error " + String(gLastCode);
}

}  // namespace cloud

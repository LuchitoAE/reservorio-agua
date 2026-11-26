#include "web/WebUI.h"

#include <ArduinoJson.h>
#include <LittleFS.h>

#include "ConfigStore.h"
#include "Telemetry.h"
#include "config.h"
#include "sensors/Sensors.h"

namespace {
const char* kFallbackHtml = R"HTML(<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reservorio - falta la web</title>
<style>
 body{font-family:system-ui,sans-serif;background:#071626;color:#e8f4ff;
      display:grid;place-items:center;min-height:100vh;margin:0;padding:24px}
 main{max-width:560px}h1{font-size:1.4rem}code{background:#0e2438;padding:2px 6px;border-radius:4px}
 a{color:#4fd1c5}
</style></head><body><main>
<h1>Firmware OK, dashboard sin instalar</h1>
<p>El ESP32 arranco correctamente y la API responde, pero los archivos de la web no
estan en la memoria flash.</p>
<p>Desde el computador ejecuta:</p>
<pre><code>npm run sync
pio run -d firmware -t uploadfs</code></pre>
<p>Mientras tanto puedes ver los datos crudos en
<a href="/api/telemetry">/api/telemetry</a>.</p>
</main></body></html>)HTML";

String fullConfigJson(const ConfigStore& config) {
  JsonDocument doc;
  doc["tankHeightCm"] = config.tankHeightCm();
  doc["maxLevelCm"] = config.maxLevelCm();
  doc["sensorOffsetCm"] = config.sensorOffsetCm();
  doc["tankLengthCm"] = cfg::TANK_INTERNAL_LENGTH_CM;
  doc["tankWidthCm"] = cfg::TANK_INTERNAL_WIDTH_CM;
  doc["phNeutralV"] = config.phNeutralV();
  doc["phSlopeV"] = config.phSlopeV();
  doc["turbClearV"] = config.turbClearV();
  doc["turbTurbidV"] = config.turbTurbidV();
  doc["flowPulsesPerLiter"] = config.flowPulsesPerLiter();
  doc["flowTotalInL"] = config.flowTotalL(FlowSensor::kIn);
  doc["flowTotalOutL"] = config.flowTotalL(FlowSensor::kOut);
  String out;
  serializeJson(doc, out);
  return out;
}
}  // namespace

void WebUI::begin(Sensors* sensors, ConfigStore* config) {
  sensors_ = sensors;
  config_ = config;

  if (!LittleFS.begin(true)) {
    Serial.println("[web] LittleFS no pudo montarse");
  }

  registerRoutes();
  server_.begin();
  Serial.printf("[web] http://%s/\n", telemetry::ipAddress().c_str());
}

void WebUI::loop() {
  server_.handleClient();

  if (rebootPending_ && millis() >= rebootAtMs_) {
    Serial.println("[web] reiniciando por peticion...");
    ESP.restart();
  }
}

void WebUI::addCorsHeaders() {
  server_.sendHeader("Access-Control-Allow-Origin", "*");
  server_.sendHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  server_.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server_.sendHeader("Cache-Control", "no-cache");
}

void WebUI::registerRoutes() {
  server_.on("/", HTTP_GET, [this]() {
    if (!serveFile("/index.html")) {
      addCorsHeaders();
      server_.send(200, "text/html", kFallbackHtml);
    }
  });
  server_.on("/index.html", HTTP_GET, [this]() { serveFile("/index.html"); });

  server_.on("/api/telemetry", HTTP_GET, [this]() { handleTelemetry(); });
  server_.on("/api/config", HTTP_GET, [this]() { handleGetConfig(); });
  server_.on("/api/config", HTTP_POST, [this]() { handleSetConfig(); });
  server_.on("/api/reset", HTTP_POST, [this]() { handleReset(); });
  server_.on("/api/calibrate", HTTP_POST, [this]() { handleCalibrate(); });
  server_.on("/api/reboot", HTTP_POST, [this]() { handleReboot(); });

  server_.onNotFound([this]() { handleNotFound(); });
}

void WebUI::handleTelemetry() {
  if (sensors_ == nullptr || config_ == nullptr) {
    addCorsHeaders();
    server_.send(503, "application/json", "{\"error\":\"no inicializado\"}");
    return;
  }
  JsonDocument doc;
  telemetry::build(doc, *sensors_, *config_);
  String out;
  serializeJson(doc, out);
  addCorsHeaders();
  server_.send(200, "application/json", out);
}

void WebUI::handleGetConfig() {
  if (config_ == nullptr) {
    addCorsHeaders();
    server_.send(503, "application/json", "{\"error\":\"no inicializado\"}");
    return;
  }
  addCorsHeaders();
  server_.send(200, "application/json", fullConfigJson(*config_));
}

void WebUI::handleSetConfig() {
  if (config_ == nullptr) {
    addCorsHeaders();
    server_.send(503, "application/json", "{\"error\":\"no inicializado\"}");
    return;
  }

  JsonDocument doc;
  const DeserializationError err = deserializeJson(doc, server_.arg("plain"));
  if (err) {
    addCorsHeaders();
    server_.send(400, "application/json", "{\"error\":\"json invalido\"}");
    return;
  }

  const float height = doc["tankHeightCm"] | config_->tankHeightCm();
  const float offset = doc["sensorOffsetCm"] | config_->sensorOffsetCm();
  config_->setTank(height, offset);

  if (!doc["maxLevelCm"].isNull()) {
    config_->setMaxLevel(doc["maxLevelCm"].as<float>());
  }

  if (!doc["flowPulsesPerLiter"].isNull()) {
    config_->setFlowPulsesPerLiter(doc["flowPulsesPerLiter"].as<float>());
  }

  addCorsHeaders();
  server_.send(200, "application/json", fullConfigJson(*config_));
}

void WebUI::handleReset() {
  JsonDocument doc;
  deserializeJson(doc, server_.arg("plain"));
  const String what = doc["what"] | "";

  if (sensors_ != nullptr && (what == "flow" || what == "flowIn" || what == "flowOut")) {
    // "flow" reinicia los dos acumulados; "flowIn"/"flowOut" solo uno.
    if (what != "flowOut") sensors_->flowIn().resetTotal();
    if (what != "flowIn") sensors_->flowOut().resetTotal();
  } else {
    addCorsHeaders();
    server_.send(400, "application/json", "{\"error\":\"que reiniciar?\"}");
    return;
  }

  addCorsHeaders();
  server_.send(200, "application/json", "{\"ok\":true}");
}

void WebUI::handleCalibrate() {
  if (sensors_ == nullptr || config_ == nullptr) {
    addCorsHeaders();
    server_.send(503, "application/json", "{\"error\":\"no inicializado\"}");
    return;
  }

  JsonDocument doc;
  const DeserializationError err = deserializeJson(doc, server_.arg("plain"));
  if (err) {
    addCorsHeaders();
    server_.send(400, "application/json", "{\"error\":\"json invalido\"}");
    return;
  }

  const String sensor = doc["sensor"] | "";
  bool ok = false;
  String label = sensor;

  if (sensor == "ph7") {
    ok = sensors_->ph().calibrateNeutral();
  } else if (sensor == "ph4") {
    ok = sensors_->ph().calibrateSecondPoint(4.0f);
  } else if (sensor == "ph10") {
    ok = sensors_->ph().calibrateSecondPoint(10.0f);
  } else if (sensor == "turbidity-clear") {
    ok = sensors_->turbidity().calibrateClear();
  } else if (sensor == "turbidity-turbid") {
    ok = sensors_->turbidity().calibrateTurbid();
  } else if (sensor == "level-empty") {
    // Tanque vacío: la distancia medida hasta el fondo pasa a ser la altura de calibración.
    const float d = sensors_->level().measureSteady();
    ok = !isnan(d) && d >= 10.0f && d <= cfg::MAX_VALID_DISTANCE_CM;
    if (ok) config_->setTank(d, config_->sensorOffsetCm());
  } else {
    addCorsHeaders();
    server_.send(400, "application/json", "{\"error\":\"sensor desconocido\"}");
    return;
  }

  JsonDocument out;
  out["ok"] = ok;
  out["sensor"] = label;
  out["phNeutralV"] = config_->phNeutralV();
  out["phSlopeV"] = config_->phSlopeV();
  out["turbClearV"] = config_->turbClearV();
  out["turbTurbidV"] = config_->turbTurbidV();
  out["tankHeightCm"] = config_->tankHeightCm();
  if (!ok) out["error"] = "lectura fuera de rango, revisa el sensor";

  String body;
  serializeJson(out, body);
  addCorsHeaders();
  server_.send(ok ? 200 : 422, "application/json", body);
}

void WebUI::handleReboot() {
  addCorsHeaders();
  server_.send(200, "application/json", "{\"ok\":true,\"reboot\":true}");
  rebootPending_ = true;
  rebootAtMs_ = millis() + 800;
}

void WebUI::handleOptions() {
  addCorsHeaders();
  server_.send(204);
}

void WebUI::handleNotFound() {
  if (server_.method() == HTTP_OPTIONS) {
    handleOptions();
    return;
  }

  const String path = server_.uri();
  if (path.startsWith("/api/")) {
    addCorsHeaders();
    server_.send(404, "application/json", "{\"error\":\"ruta no encontrada\"}");
    return;
  }

  if (path.indexOf("..") >= 0) {
    server_.send(400, "text/plain", "ruta invalida");
    return;
  }

  if (!serveFile(path)) {
    server_.send(404, "text/plain", "404: " + path);
  }
}

bool WebUI::serveFile(const String& path) {
  if (!LittleFS.exists(path)) return false;

  File file = LittleFS.open(path, "r");
  if (!file || file.isDirectory()) {
    file.close();
    return false;
  }

  addCorsHeaders();
  server_.streamFile(file, mimeFor(path));
  file.close();
  return true;
}

String WebUI::mimeFor(const String& path) {
  const int dot = path.lastIndexOf('.');
  String ext = dot >= 0 ? path.substring(dot + 1) : String();
  ext.toLowerCase();

  if (ext == "html") return "text/html; charset=utf-8";
  if (ext == "css") return "text/css; charset=utf-8";
  if (ext == "js" || ext == "mjs") return "application/javascript; charset=utf-8";
  if (ext == "json") return "application/json";
  if (ext == "svg") return "image/svg+xml";
  if (ext == "png") return "image/png";
  if (ext == "jpg" || ext == "jpeg") return "image/jpeg";
  if (ext == "ico") return "image/x-icon";
  if (ext == "woff2") return "font/woff2";
  if (ext == "txt") return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

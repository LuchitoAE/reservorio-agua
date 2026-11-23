#pragma once
#include <WebServer.h>

class ConfigStore;
class Sensors;

/**
 * Servidor HTTP del ESP32:
 *  - Sirve el dashboard estático desde LittleFS.
 *  - Expone /api/telemetry, /api/config, /api/reset, /api/calibrate, /api/reboot.
 */
class WebUI {
 public:
  void begin(Sensors* sensors, ConfigStore* config);
  void loop();

 private:
  void registerRoutes();
  void addCorsHeaders();

  void handleTelemetry();
  void handleGetConfig();
  void handleSetConfig();
  void handleReset();
  void handleCalibrate();
  void handleReboot();
  void handleNotFound();
  void handleOptions();

  bool serveFile(const String& path);
  static String mimeFor(const String& path);

  WebServer server_{80};
  Sensors* sensors_ = nullptr;
  ConfigStore* config_ = nullptr;
  bool rebootPending_ = false;
  uint32_t rebootAtMs_ = 0;
};

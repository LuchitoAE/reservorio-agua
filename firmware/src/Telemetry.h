#pragma once
#include <Arduino.h>
#include <ArduinoJson.h>

class ConfigStore;
class Sensors;

namespace telemetry {

/** Rellena `doc` con todas las lecturas y el estado del sistema. */
void build(JsonDocument& doc, const Sensors& sensors, const ConfigStore& config);

String ipAddress();
String wifiStatus();
int rssi();

}  // namespace telemetry

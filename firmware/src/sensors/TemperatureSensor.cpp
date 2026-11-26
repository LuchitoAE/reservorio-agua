#include "sensors/TemperatureSensor.h"

namespace {
constexpr uint32_t kRescanMs = 5000;        // buscar el sensor otra vez si no hay ninguno
constexpr uint32_t kConversionMs = 800;     // 750 ms a 12 bits + margen
constexpr uint8_t kFailsBeforeRescan = 3;
}  // namespace

void TemperatureSensor::begin() {
  sensor_.setWaitForConversion(false);
  scanBus();
  Serial.printf("[temp] dispositivos en el bus 1-Wire: %u\n", deviceCount_);

  if (deviceCount_ > 0) sensor_.requestTemperatures();
  conversionPending_ = deviceCount_ > 0;
  conversionStartMs_ = millis();
}

bool TemperatureSensor::scanBus() {
  sensor_.begin();
  deviceCount_ = sensor_.getDeviceCount();
  lastScanMs_ = millis();
  if (deviceCount_ > 0) sensor_.setResolution(12);
  return deviceCount_ > 0;
}

void TemperatureSensor::update() {
  const uint32_t now = millis();

  if (deviceCount_ == 0) {
    if (now - lastScanMs_ < kRescanMs) return;
    if (!scanBus()) return;
    Serial.printf("[temp] sensor detectado (%u en el bus)\n", deviceCount_);
    sensor_.requestTemperatures();
    conversionPending_ = true;
    conversionStartMs_ = now;
    return;
  }

  if (!conversionPending_) {
    if (now - conversionStartMs_ < cfg::TEMP_INTERVAL_MS) return;
    sensor_.requestTemperatures();
    conversionPending_ = true;
    conversionStartMs_ = now;
    return;
  }

  if (now - conversionStartMs_ < kConversionMs) return;

  const float value = sensor_.getTempCByIndex(0);
  conversionPending_ = false;

  if (value == DEVICE_DISCONNECTED_C || value < -50.0f || value > 100.0f) {
    if (failStreak_ < 255) failStreak_++;
    if (failStreak_ >= kFailsBeforeRescan) {
      celsius_ = NAN;
      ok_ = false;
      deviceCount_ = 0;  // dejó de responder: volver a buscarlo
      lastScanMs_ = now;
      failStreak_ = 0;
      Serial.println("[temp] el sensor no responde; se vuelve a buscar cada 5 s");
    }
    return;
  }

  failStreak_ = 0;
  celsius_ = value;
  ok_ = true;
}

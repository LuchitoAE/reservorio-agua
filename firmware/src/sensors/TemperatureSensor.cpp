#include "sensors/TemperatureSensor.h"

void TemperatureSensor::begin() {
  sensor_.begin();
  deviceCount_ = sensor_.getDeviceCount();
  sensor_.setResolution(12);
  sensor_.setWaitForConversion(false);

  Serial.printf("[temp] dispositivos en el bus 1-Wire: %u\n", deviceCount_);

  if (deviceCount_ > 0) sensor_.requestTemperatures();
  conversionPending_ = deviceCount_ > 0;
  conversionStartMs_ = millis();
}

void TemperatureSensor::update() {
  const uint32_t now = millis();

  if (!conversionPending_) {
    if (now - conversionStartMs_ < cfg::TEMP_INTERVAL_MS) return;
    sensor_.requestTemperatures();
    conversionPending_ = true;
    conversionStartMs_ = now;
    return;
  }

  if (now - conversionStartMs_ < 800) return;  // 750 ms a 12 bits + margen

  const float value = sensor_.getTempCByIndex(0);
  conversionPending_ = false;

  if (value == DEVICE_DISCONNECTED_C || value < -50.0f || value > 100.0f) {
    if (failStreak_ < 255) failStreak_++;
    if (failStreak_ >= 3) {
      celsius_ = NAN;
      ok_ = false;
    }
    return;
  }

  failStreak_ = 0;
  celsius_ = value;
  ok_ = true;
}

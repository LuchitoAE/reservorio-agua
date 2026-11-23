#include "sensors/TurbiditySensor.h"

#include "ConfigStore.h"
#include "config.h"

void TurbiditySensor::begin(ConfigStore* config) {
  config_ = config;
  analogReadResolution(12);
  analogSetPinAttenuation(PIN_TURB_ADC, ADC_11db);
  pinMode(PIN_TURB_ADC, INPUT);
  raw_ = analogRead(PIN_TURB_ADC);
  voltage_ = (static_cast<float>(raw_) / cfg::ADC_MAX_COUNTS) * cfg::ADC_VREF * cfg::TURBIDITY_DIVIDER;
  filter_.push(voltage_);
  lastSampleMs_ = millis();
}

void TurbiditySensor::update() {
  const uint32_t now = millis();
  if (now - lastSampleMs_ < cfg::TURB_INTERVAL_MS) return;
  lastSampleMs_ = now;

  raw_ = analogRead(PIN_TURB_ADC);
  voltage_ = (static_cast<float>(raw_) / cfg::ADC_MAX_COUNTS) * cfg::ADC_VREF * cfg::TURBIDITY_DIVIDER;
  filter_.push(voltage_);
  ok_ = raw_ > 20 && raw_ < 4075;
}

float TurbiditySensor::ntu() const {
  const float v = filter_.median();
  if (isnan(v)) return NAN;
  float value = -1120.4f * v * v + 5742.3f * v - 4352.9f;
  if (value < 0.0f) value = 0.0f;
  return value;
}

float TurbiditySensor::clarityPercent() const {
  if (config_ == nullptr) return NAN;
  const float v = filter_.median();
  const float reference = config_->turbClearV();
  if (isnan(v) || reference <= 0.0f) return NAN;
  float pct = (v / reference) * 100.0f;
  return constrain(pct, 0.0f, 100.0f);
}

bool TurbiditySensor::calibrateClear() {
  if (config_ == nullptr) return false;
  float sum = 0;
  for (uint8_t i = 0; i < 20; i++) {
    const int r = analogRead(PIN_TURB_ADC);
    sum += (static_cast<float>(r) / cfg::ADC_MAX_COUNTS) * cfg::ADC_VREF * cfg::TURBIDITY_DIVIDER;
    delay(20);
  }
  const float v = sum / 20.0f;
  if (v < 0.2f || v > 5.0f) return false;
  config_->setTurbClearV(v);
  filter_.reset();
  return true;
}

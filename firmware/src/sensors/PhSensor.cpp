#include "sensors/PhSensor.h"

#include "ConfigStore.h"
#include "config.h"

void PhSensor::begin(ConfigStore* config) {
  config_ = config;
  analogReadResolution(12);
  analogSetPinAttenuation(PIN_PH_ADC, ADC_11db);
  pinMode(PIN_PH_ADC, INPUT);
  raw_ = analogRead(PIN_PH_ADC);
  voltage_ = readVoltage();
  filter_.push(voltage_);
  lastSampleMs_ = millis();
}

float PhSensor::readVoltage() {
  // El ADC entrega 0..4095; se convierte al voltaje real en el pin y se
  // deshace el divisor de tensión si lo hay.
  return (static_cast<float>(raw_) / cfg::ADC_MAX_COUNTS) * cfg::ADC_VREF * cfg::PH_DIVIDER;
}

void PhSensor::update() {
  const uint32_t now = millis();
  if (now - lastSampleMs_ < cfg::PH_INTERVAL_MS) return;
  lastSampleMs_ = now;

  raw_ = analogRead(PIN_PH_ADC);
  voltage_ = readVoltage();
  filter_.push(voltage_);

  // 0 o 4095 sostenidos = entrada saturada / sensor desconectado.
  ok_ = raw_ > 20 && raw_ < 4075;
}

float PhSensor::ph() const {
  if (config_ == nullptr) return NAN;
  const float v = filter_.median();
  if (isnan(v)) return NAN;
  const float slope = config_->phSlopeV();
  if (slope < 0.001f) return NAN;
  return 7.0f + (config_->phNeutralV() - v) / slope;
}

bool PhSensor::ok() const {
  const float value = ph();
  return ok_ && !isnan(value) && value > -2.0f && value < 16.0f;
}

float PhSensor::sampleAverage(uint8_t samples) {
  float sum = 0;
  uint8_t used = 0;
  for (uint8_t i = 0; i < samples; i++) {
    const int r = analogRead(PIN_PH_ADC);
    sum += (static_cast<float>(r) / cfg::ADC_MAX_COUNTS) * cfg::ADC_VREF * cfg::PH_DIVIDER;
    used++;
    delay(20);
  }
  return used > 0 ? sum / used : NAN;
}

bool PhSensor::calibrateNeutral() {
  if (config_ == nullptr) return false;
  const float v = sampleAverage(20);
  if (isnan(v) || v < 0.1f || v > 4.9f) return false;
  config_->setPhCalibration(v, config_->phSlopeV());
  filter_.reset();
  return true;
}

bool PhSensor::calibrateSecondPoint(float knownPh) {
  if (config_ == nullptr) return false;
  const float v = sampleAverage(20);
  if (isnan(v) || v < 0.1f || v > 4.9f) return false;

  const float neutral = config_->phNeutralV();
  // pendiente = ΔV / ΔpH, en valor absoluto para que funcione con buffer 4 o 10
  const float slope = (neutral - v) / (7.0f - knownPh);
  if (fabsf(slope) < 0.02f || fabsf(slope) > 0.6f) return false;

  config_->setPhCalibration(neutral, fabsf(slope));
  filter_.reset();
  return true;
}

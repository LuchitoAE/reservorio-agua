#include "sensors/TurbiditySensor.h"

#include "ConfigStore.h"
#include "config.h"

namespace {
constexpr float kFormulaMinV = 2.5f;   // límite inferior de la curva del fabricante
constexpr float kMaxNtu = 3000.0f;

// Voltaje de la salida A del módulo (antes del divisor). Promedia 16 lecturas del ADC:
// una sola salta en escalones de ~0.03 V, que en este sensor son ~10 % de claridad.
float readVolts() {
  uint32_t sum = 0;
  for (uint8_t i = 0; i < 16; i++) sum += analogReadMilliVolts(PIN_TURB_ADC);
  return sum / 16.0f / 1000.0f * cfg::TURBIDITY_DIVIDER;
}

float averageVolts(uint8_t samples) {
  float sum = 0;
  for (uint8_t i = 0; i < samples; i++) {
    sum += readVolts();
    delay(20);
  }
  return sum / samples;
}
}  // namespace

void TurbiditySensor::begin(ConfigStore* config) {
  config_ = config;
  analogReadResolution(12);
  analogSetPinAttenuation(PIN_TURB_ADC, ADC_11db);
  pinMode(PIN_TURB_ADC, INPUT);
  raw_ = analogRead(PIN_TURB_ADC);
  voltage_ = readVolts();
  filter_.push(voltage_);
  lastSampleMs_ = millis();
}

void TurbiditySensor::update() {
  const uint32_t now = millis();
  if (now - lastSampleMs_ < cfg::TURB_INTERVAL_MS) return;
  lastSampleMs_ = now;

  raw_ = analogRead(PIN_TURB_ADC);
  voltage_ = readVolts();
  filter_.push(voltage_);
  ok_ = raw_ > 20 && raw_ < 4075;
}

float TurbiditySensor::clearV() const {
  return config_ != nullptr ? config_->turbClearV() : cfg::DEFAULT_TURB_CLEAR_V;
}

float TurbiditySensor::turbidV() const {
  return config_ != nullptr ? config_->turbTurbidV() : cfg::DEFAULT_TURB_TURBID_V;
}

float TurbiditySensor::steadyVolts() {
  if (filter_.count() >= 10) return filteredVolts();
  return averageVolts(60);  // ~1.2 s de lecturas promediadas
}

float TurbiditySensor::ntu() const {
  const float v = filteredVolts();
  const float clear = clearV();
  if (isnan(v) || clear <= 0.0f) return NAN;
  const float ve = v * cfg::TURB_FORMULA_CLEAR_V / clear;
  // Debajo de 2.5 V la parábola vuelve a bajar: agua más turbia daría menos NTU.
  if (ve < kFormulaMinV) return kMaxNtu;
  const float value = -1120.4f * ve * ve + 5742.3f * ve - 4352.9f;
  return constrain(value, 0.0f, kMaxNtu);
}

float TurbiditySensor::clarityPercent() const {
  const float v = filteredVolts();
  const float clear = clearV();
  const float turbid = turbidV();
  if (isnan(v) || clear <= 0.0f) return NAN;
  float pct;
  if (turbid > 0.0f && clear - turbid > 0.02f) {
    pct = (v - turbid) / (clear - turbid) * 100.0f;
  } else {
    pct = v / clear * 100.0f;  // sin referencia turbia válida
  }
  return constrain(pct, 0.0f, 100.0f);
}

// Se calibra con el mismo valor que se muestra: así el agua de referencia da 100 % / 0 %.
bool TurbiditySensor::calibrateClear() {
  if (config_ == nullptr) return false;
  const float v = steadyVolts();
  if (isnan(v) || v < 0.2f || v > 5.0f) return false;
  config_->setTurbClearV(v);
  return true;
}

bool TurbiditySensor::calibrateTurbid() {
  if (config_ == nullptr) return false;
  const float v = steadyVolts();
  if (isnan(v) || v < 0.2f || v > 5.0f) return false;
  config_->setTurbTurbidV(v);
  return true;
}

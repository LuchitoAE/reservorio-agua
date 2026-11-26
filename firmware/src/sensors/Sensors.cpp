#include "sensors/Sensors.h"

#include <math.h>

#include "config.h"

void Sensors::begin(ConfigStore* config) {
  config_ = config;
  level_.begin();
  flowIn_.begin(config, PIN_FLOW_IN, FlowSensor::kIn);
  flowOut_.begin(config, PIN_FLOW_OUT, FlowSensor::kOut);
  temperature_.begin();
  ph_.begin(config);
  turbidity_.begin(config);
}

void Sensors::update() {
  level_.update();
  flowIn_.update();
  flowOut_.update();
  temperature_.update();
  ph_.update();
  turbidity_.update();
}

float Sensors::levelCm() const {
  if (config_ == nullptr) return NAN;
  if (!level_.ok() || isnan(level_.distanceCm())) return NAN;

  const float height = config_->tankHeightCm();
  const float level = height - level_.distanceCm() - config_->sensorOffsetCm();
  if (level < cfg::LEVEL_DEADBAND_CM) return 0.0f;  // el ruido no marca 1-3 % en vacío
  return constrain(level, 0.0f, height);
}

float Sensors::levelPercent() const {
  if (config_ == nullptr) return NAN;
  const float maxLevel = min(config_->maxLevelCm(), config_->tankHeightCm());
  if (maxLevel <= 0) return NAN;
  const float cm = levelCm();
  if (isnan(cm)) return NAN;
  return constrain((cm / maxLevel) * 100.0f, 0.0f, 100.0f);
}

float Sensors::liters() const {
  const float cm = levelCm();
  if (isnan(cm)) return NAN;
  const float level = min(cm, cfg::TANK_INTERNAL_HEIGHT_CM);
  // Reservorio rectangular: cm³ -> litros
  return (cfg::TANK_INTERNAL_LENGTH_CM * cfg::TANK_INTERNAL_WIDTH_CM * level) / 1000.0f;
}

uint8_t Sensors::okCount() const {
  return static_cast<uint8_t>(level_.ok()) + static_cast<uint8_t>(flowIn_.ok()) +
         static_cast<uint8_t>(flowOut_.ok()) +
         static_cast<uint8_t>(temperature_.ok()) + static_cast<uint8_t>(ph_.ok()) +
         static_cast<uint8_t>(turbidity_.ok());
}

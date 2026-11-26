#pragma once
#include "ConfigStore.h"
#include "sensors/FlowSensor.h"
#include "sensors/PhSensor.h"
#include "sensors/TemperatureSensor.h"
#include "sensors/TurbiditySensor.h"
#include "sensors/Ultrasonic.h"

/**
 * Agrupa todos los sensores y expone lecturas derivadas (nivel, litros).
 */
class Sensors {
 public:
  void begin(ConfigStore* config);
  void update();

  Ultrasonic& level() { return level_; }
  FlowSensor& flowIn() { return flowIn_; }    // caudalímetro de entrada
  FlowSensor& flowOut() { return flowOut_; }  // caudalímetro de salida
  TemperatureSensor& temperature() { return temperature_; }
  PhSensor& ph() { return ph_; }
  TurbiditySensor& turbidity() { return turbidity_; }

  const Ultrasonic& level() const { return level_; }
  const FlowSensor& flowIn() const { return flowIn_; }
  const FlowSensor& flowOut() const { return flowOut_; }
  const TemperatureSensor& temperature() const { return temperature_; }
  const PhSensor& ph() const { return ph_; }
  const TurbiditySensor& turbidity() const { return turbidity_; }

  // Derivados -------------------------------------------------------------
  float levelCm() const;
  float levelPercent() const;
  float liters() const;
  uint8_t okCount() const;

 private:
  ConfigStore* config_ = nullptr;
  Ultrasonic level_;
  FlowSensor flowIn_;
  FlowSensor flowOut_;
  TemperatureSensor temperature_;
  PhSensor ph_;
  TurbiditySensor turbidity_;
};

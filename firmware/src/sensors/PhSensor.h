#pragma once
#include <Arduino.h>

#include "util/MedianFilter.h"

class ConfigStore;

/**
 * Módulo de pH (PH-7BNC / equivalente PH-4502C) en un canal ADC1.
 * Calibración de dos puntos: buffer 7.00 y buffer 4.00.
 *
 *   pH = 7.0 + (V_neutro - V_medido) / pendiente
 */
class PhSensor {
 public:
  void begin(ConfigStore* config);
  void update();

  float ph() const;
  float voltage() const { return voltage_; }
  int raw() const { return raw_; }
  bool ok() const;

  bool calibrateNeutral();          // asume buffer pH 7.00
  bool calibrateSecondPoint(float knownPh);  // buffer 4.00 o 10.00

 private:
  float readVoltage();
  float sampleAverage(uint8_t samples);

  ConfigStore* config_ = nullptr;
  MedianFilter<15> filter_;

  int raw_ = 0;
  float voltage_ = 0;
  uint32_t lastSampleMs_ = 0;
  bool ok_ = false;
};

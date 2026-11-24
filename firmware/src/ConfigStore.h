#pragma once
#include <Arduino.h>

/**
 * Parámetros de instalación y calibración persistidos en NVS (Preferences).
 * Si una clave no existe se usa el valor por defecto de config.h.
 */
class ConfigStore {
 public:
  void begin();

  // --- Tanque ---
  float tankHeightCm() const { return tankHeightCm_; }
  float maxLevelCm() const { return maxLevelCm_; }
  float sensorOffsetCm() const { return sensorOffsetCm_; }
  void setTank(float heightCm, float offsetCm);
  void setMaxLevel(float maxLevelCm);

  // --- pH ---
  float phNeutralV() const { return phNeutralV_; }
  float phSlopeV() const { return phSlopeV_; }
  void setPhCalibration(float neutralV, float slopeV);

  // --- Turbidez ---
  float turbClearV() const { return turbClearV_; }
  void setTurbClearV(float volts);

  // --- Flujo ---
  float flowPulsesPerLiter() const { return flowPpl_; }
  void setFlowPulsesPerLiter(float ppl);
  float flowTotalL() const { return flowTotalL_; }
  void saveFlowTotalL(float liters);

  void resetToDefaults();

 private:
  float tankHeightCm_ = 0;
  float maxLevelCm_ = 0;
  float sensorOffsetCm_ = 0;
  float phNeutralV_ = 0;
  float phSlopeV_ = 0;
  float turbClearV_ = 0;
  float flowPpl_ = 0;
  float flowTotalL_ = 0;
};

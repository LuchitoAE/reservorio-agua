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
  float turbTurbidV() const { return turbTurbidV_; }
  void setTurbClearV(float volts);
  void setTurbTurbidV(float volts);

  // --- Flujo ---
  float flowPulsesPerLiter() const { return flowPpl_; }
  void setFlowPulsesPerLiter(float ppl);
  // Acumulado por caudalímetro: 0 = entrada, 1 = salida (FlowSensor::kIn / kOut).
  float flowTotalL(uint8_t index) const { return index < 2 ? flowTotalL_[index] : 0; }
  void saveFlowTotalL(uint8_t index, float liters);

  // --- Redes WiFi guardadas desde la página /wifi (además de la de secrets.h) ---
  static constexpr uint8_t kMaxWifi = 3;
  uint8_t wifiCount() const { return wifiCount_; }
  String wifiSsid(uint8_t i) const { return i < wifiCount_ ? wifiSsid_[i] : String(); }
  String wifiPass(uint8_t i) const { return i < wifiCount_ ? wifiPass_[i] : String(); }
  void saveWifi(const String& ssid, const String& pass);  // la más reciente queda primera
  bool forgetWifi(const String& ssid);

  void resetToDefaults();

 private:
  float tankHeightCm_ = 0;
  float maxLevelCm_ = 0;
  float sensorOffsetCm_ = 0;
  float phNeutralV_ = 0;
  float phSlopeV_ = 0;
  float turbClearV_ = 0;
  float turbTurbidV_ = 0;
  float flowPpl_ = 0;
  float flowTotalL_[2] = {0, 0};
  String wifiSsid_[kMaxWifi];
  String wifiPass_[kMaxWifi];
  uint8_t wifiCount_ = 0;

  void persistWifi();
};

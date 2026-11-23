#pragma once
#include <Arduino.h>

class ConfigStore;

/**
 * YF-S201: sensor de efecto Hall. 450 pulsos por litro.
 * Cuenta pulsos por interrupción y calcula caudal en ventanas de 1 s.
 */
class FlowSensor {
 public:
  void begin(ConfigStore* config);
  void update();

  float litersPerMinute() const { return lpm_; }
  float totalLiters() const { return totalLiters_; }
  uint32_t totalPulses() const { return pulsesTotal_; }
  bool ok() const { return ok_; }

  void resetTotal();

 private:
  static void ARDUINO_ISR_ATTR isr();
  static FlowSensor* instance_;

  volatile uint32_t pulsesTotal_ = 0;  // incrementado en la ISR

  ConfigStore* config_ = nullptr;
  uint32_t lastWindowMs_ = 0;
  uint32_t lastWindowPulses_ = 0;
  uint32_t lastSaveMs_ = 0;
  uint32_t lastPulseMs_ = 0;
  float lpm_ = 0;
  float totalLiters_ = 0;
  bool ok_ = false;
};

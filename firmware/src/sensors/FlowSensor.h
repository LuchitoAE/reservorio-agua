#pragma once
#include <Arduino.h>

class ConfigStore;

/**
 * ZJ-S201 / YF-S201: caudalímetro de efecto Hall de 1/2". F = 7.5 × Q (L/min),
 * es decir 450 pulsos por litro. Cuenta pulsos por interrupción y calcula el caudal
 * en ventanas de 1 s. Hay dos: entrada (FlowSensor::kIn) y salida (FlowSensor::kOut).
 */
class FlowSensor {
 public:
  static constexpr uint8_t kIn = 0;
  static constexpr uint8_t kOut = 1;

  void begin(ConfigStore* config, uint8_t pin, uint8_t index);
  void update();

  float litersPerMinute() const { return lpm_; }
  float totalLiters() const { return totalLiters_; }
  uint32_t totalPulses() const { return pulsesTotal_; }
  bool ok() const { return ok_; }

  void resetTotal();

 private:
  static void ARDUINO_ISR_ATTR isr(void* arg);

  volatile uint32_t pulsesTotal_ = 0;  // incrementado en la ISR
  volatile uint32_t lastEdgeUs_ = 0;   // filtro de ruido en la ISR

  ConfigStore* config_ = nullptr;
  uint8_t pin_ = 0;
  uint8_t index_ = kIn;
  uint32_t lastWindowMs_ = 0;
  uint32_t lastWindowPulses_ = 0;
  uint32_t lastSaveMs_ = 0;
  float lpm_ = 0;
  float totalLiters_ = 0;
  float savedLiters_ = 0;
  bool ok_ = false;
};

#pragma once
#include <Arduino.h>

#include "util/MedianFilter.h"

/**
 * HC-SR04: mide distancia al agua. Devuelve NAN mientras no haya lectura válida.
 * La conversión a nivel/porcentaje la hace Telemetry con la altura configurada.
 */
class Ultrasonic {
 public:
  void begin();
  void update();

  float distanceCm() const { return distanceCm_; }
  bool ok() const { return ok_; }
  uint32_t lastReadMs() const { return lastReadMs_; }

 private:
  float measureOnce();

  MedianFilter<5> filter_;
  float distanceCm_ = NAN;
  bool ok_ = false;
  uint32_t lastSampleMs_ = 0;
  uint32_t lastReadMs_ = 0;
  uint8_t failStreak_ = 0;
};

#pragma once
#include <Arduino.h>

#include "util/MedianFilter.h"

class ConfigStore;

/**
 * Gravity SEN0189 (TS-300B), salida analógica 0..4.5 V.
 * OJO: entrega más de 3.3 V, usar divisor (config: TURBIDITY_DIVIDER).
 *
 * NTU según la curva del fabricante (aproximada):
 *   NTU = -1120.4·V² + 5742.3·V - 4352.9
 * Claridad = V / V_agua_clara * 100
 */
class TurbiditySensor {
 public:
  void begin(ConfigStore* config);
  void update();

  float ntu() const;
  float clarityPercent() const;
  float voltage() const { return voltage_; }
  int raw() const { return raw_; }
  bool ok() const { return ok_; }

  bool calibrateClear();  // guarda el voltaje de referencia de agua clara

 private:
  int raw_ = 0;
  float voltage_ = 0;
  ConfigStore* config_ = nullptr;
  MedianFilter<15> filter_;
  uint32_t lastSampleMs_ = 0;
  bool ok_ = false;
};

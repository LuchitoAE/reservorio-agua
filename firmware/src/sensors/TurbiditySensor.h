#pragma once
#include <Arduino.h>

#include "util/MedianFilter.h"

class ConfigStore;

/**
 * TS-300B (compatible con Gravity SEN0189), salida analógica de hasta ~4.5 V.
 * OJO: entrega más de 3.3 V, usar divisor (config: TURBIDITY_DIVIDER).
 *
 * El voltaje se lee con analogReadMilliVolts (calibración de fábrica del ADC), igual
 * que la prueba de banco pruebas/turbidez, para que sus referencias sirvan tal cual.
 *
 * Claridad (dos puntos):  (V - V_turbia) / (V_clara - V_turbia) * 100
 * NTU (estimado): la lectura se escala para que el agua clara propia equivalga a los
 * 4.2 V de la curva del fabricante y luego se aplica
 *   NTU = -1120.4·Ve² + 5742.3·Ve - 4352.9,   Ve = V * 4.2 / V_clara
 * La curva solo vale para Ve entre 2.5 y 4.2 V; debajo se informa el tope de 3000 NTU.
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

  bool calibrateClear();   // guarda el voltaje de referencia de agua clara (100 %)
  bool calibrateTurbid();  // guarda el voltaje de referencia de agua turbia (0 %)

 private:
  // Voltaje que se usa para la claridad y los NTU (media recortada de los últimos ~7 s).
  float filteredVolts() const { return filter_.trimmedMean(); }
  // Para calibrar: exactamente lo que se está mostrando (o 3 s de lecturas si recién arranca).
  float steadyVolts();
  float clearV() const;
  float turbidV() const;

  int raw_ = 0;
  float voltage_ = 0;
  ConfigStore* config_ = nullptr;
  MedianFilter<15> filter_;
  uint32_t lastSampleMs_ = 0;
  bool ok_ = false;
};

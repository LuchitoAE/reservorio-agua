#pragma once
#include <Arduino.h>
#include <DallasTemperature.h>
#include <OneWire.h>

#include "config.h"

/**
 * DS18B20 en bus OneWire con pull-up de 4.7 kΩ a 3.3 V.
 * La conversión (750 ms a 12 bits) se hace de forma no bloqueante.
 * Si no hay sensor (o deja de responder) se vuelve a buscar en el bus cada 5 s,
 * así se detecta aunque se conecte con el ESP32 ya encendido.
 */
class TemperatureSensor {
 public:
  void begin();
  void update();

  float celsius() const { return celsius_; }
  bool ok() const { return ok_; }
  bool present() const { return deviceCount_ > 0; }

 private:
  bool scanBus();

  OneWire wire_{PIN_ONEWIRE};
  DallasTemperature sensor_{&wire_};

  uint8_t deviceCount_ = 0;
  bool conversionPending_ = false;
  uint32_t conversionStartMs_ = 0;
  uint32_t lastScanMs_ = 0;
  float celsius_ = NAN;
  bool ok_ = false;
  uint8_t failStreak_ = 0;
};

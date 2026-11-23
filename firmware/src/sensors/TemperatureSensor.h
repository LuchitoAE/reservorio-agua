#pragma once
#include <Arduino.h>
#include <DallasTemperature.h>
#include <OneWire.h>

#include "config.h"

/**
 * DS18B20 en bus OneWire con pull-up de 4.7 kΩ a 3.3 V.
 * La conversión (750 ms a 12 bits) se hace de forma no bloqueante.
 */
class TemperatureSensor {
 public:
  void begin();
  void update();

  float celsius() const { return celsius_; }
  bool ok() const { return ok_; }
  bool present() const { return deviceCount_ > 0; }

 private:
  OneWire wire_{PIN_ONEWIRE};
  DallasTemperature sensor_{&wire_};

  uint8_t deviceCount_ = 0;
  bool conversionPending_ = false;
  uint32_t conversionStartMs_ = 0;
  float celsius_ = NAN;
  bool ok_ = false;
  uint8_t failStreak_ = 0;
};

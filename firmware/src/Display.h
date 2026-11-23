#pragma once
#include <Arduino.h>
#include <LiquidCrystal_I2C.h>

class ConfigStore;
class Sensors;

/**
 * LCD 1602 con backpack I2C. Rota 4 páginas cada 2.5 s.
 * Detecta la dirección (0x27 o 0x3F) al arrancar; si no hay pantalla,
 * el firmware sigue funcionando normalmente.
 */
class Display {
 public:
  void begin();
  void update(const Sensors& sensors, const ConfigStore& config);

 private:
  uint8_t scanAddress() const;
  void renderPage(uint8_t page, const Sensors& sensors, const ConfigStore& config);
  void printLine(uint8_t row, const String& text);

  LiquidCrystal_I2C* lcd_ = nullptr;
  uint8_t address_ = 0;
  uint8_t page_ = 0;
  uint32_t lastChangeMs_ = 0;
  bool ready_ = false;
};

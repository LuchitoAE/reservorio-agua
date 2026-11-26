#pragma once
#include <Arduino.h>
#include <LiquidCrystal_I2C.h>

class ConfigStore;
class Sensors;

/**
 * LCD 1602 con backpack I2C, pensada para el público: solo datos relevantes y en
 * palabras simples (nivel, estado del tanque, calidad del agua y caudal). Rota las
 * páginas cada 3 s y salta las de sensores que no responden (nunca muestra "--").
 * Detecta la dirección (0x27, 0x3F o 0x20) al arrancar y, si no está, la vuelve a
 * buscar cada 5 s; sin pantalla el firmware sigue funcionando normalmente.
 */
class Display {
 public:
  void begin();
  void update(const Sensors& sensors, const ConfigStore& config);

 private:
  uint8_t scanAddress(bool fullScan) const;
  bool present(uint8_t addr) const;
  bool connect(bool fullScan);  // busca la pantalla y la inicializa
  // Dibuja la página; devuelve false si no hay datos para mostrarla (se salta).
  bool renderPage(uint8_t page, const Sensors& sensors, const ConfigStore& config);
  void printLine(uint8_t row, const String& text);

  LiquidCrystal_I2C* lcd_ = nullptr;
  uint8_t address_ = 0;
  uint8_t page_ = 0;
  uint32_t lastChangeMs_ = 0;
  uint32_t lastProbeMs_ = 0;
  bool ready_ = false;
};

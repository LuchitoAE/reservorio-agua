#include "Display.h"

#include <Wire.h>
#include <math.h>

#include "ConfigStore.h"
#include "Telemetry.h"
#include "config.h"
#include "sensors/Sensors.h"

namespace {
constexpr uint32_t kPageMs = 2500;

String pad(const String& text) {
  String out = text;
  while (out.length() < LCD_COLS) out += ' ';
  return out.substring(0, LCD_COLS);
}

String fmt(float value, uint8_t decimals, const char* unit) {
  if (isnan(value)) return String("--");
  char buf[16];
  dtostrf(value, 0, decimals, buf);
  return String(buf) + unit;
}
}  // namespace

uint8_t Display::scanAddress() const {
  // Preferimos la dirección habitual; si no está, buscamos cualquier device.
  const uint8_t preferred[] = {LCD_I2C_ADDR, 0x3F, 0x20};
  for (uint8_t addr : preferred) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) return addr;
  }
  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) return addr;
  }
  return 0;
}

void Display::begin() {
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);

  address_ = scanAddress();
  if (address_ == 0) {
    Serial.println("[lcd] no se encontro pantalla I2C");
    return;
  }

  lcd_ = new LiquidCrystal_I2C(address_, LCD_COLS, LCD_ROWS);
  lcd_->init();
  lcd_->backlight();
  lcd_->clear();
  lcd_->setCursor(0, 0);
  lcd_->print(pad(" Reservorio "));
  lcd_->setCursor(0, 1);
  lcd_->print(pad(" iniciando..."));

  ready_ = true;
  lastChangeMs_ = millis();
  Serial.printf("[lcd] pantalla en 0x%02X\n", address_);
}

void Display::printLine(uint8_t row, const String& text) {
  if (lcd_ == nullptr) return;
  lcd_->setCursor(0, row);
  lcd_->print(pad(text));
}

void Display::update(const Sensors& sensors, const ConfigStore& config) {
  if (!ready_) return;
  const uint32_t now = millis();
  if (now - lastChangeMs_ < kPageMs) return;
  lastChangeMs_ = now;

  renderPage(page_, sensors, config);
  page_ = (page_ + 1) % 4;
}

void Display::renderPage(uint8_t page, const Sensors& sensors, const ConfigStore& config) {
  if (lcd_ == nullptr) return;

  switch (page) {
    case 0:
      printLine(0, "Nivel: " + fmt(sensors.levelPercent(), 0, "%"));
      printLine(1, fmt(sensors.levelCm(), 1, " cm") + " / " + fmt(config.tankHeightCm(), 0, " cm"));
      break;
    case 1:
      printLine(0, "Temp: " + fmt(sensors.temperature().celsius(), 1, " C"));
      printLine(1, "pH:   " + fmt(sensors.ph().ph(), 2, ""));
      break;
    case 2:
      printLine(0, "Flujo: " + fmt(sensors.flow().litersPerMinute(), 1, " L/m"));
      printLine(1, "Total: " + fmt(sensors.flow().totalLiters(), 1, " L"));
      break;
    default:
      printLine(0, "Turb: " + fmt(sensors.turbidity().ntu(), 0, " NTU"));
      printLine(1, "WiFi: " + telemetry::ipAddress());
      break;
  }
}

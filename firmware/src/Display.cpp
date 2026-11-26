#include "Display.h"

#include <Wire.h>
#include <math.h>

#include "ConfigStore.h"
#include "Redes.h"
#include "config.h"
#include "sensors/Sensors.h"

namespace {
constexpr uint32_t kPageMs = 4000;  // 4 s por página: tiempo de lectura cómodo para el público
constexpr uint8_t kPageCount = 6;   // nivel, calidad, claridad, caudal + 2 de WiFi (solo sin red)
constexpr uint32_t kRetryMs = 5000; // sin pantalla: la vuelve a buscar cada 5 s

String pad(const String& text) {
  String out = text;
  while (out.length() < LCD_COLS) out += ' ';
  return out.substring(0, LCD_COLS);
}

String center(const String& text) {
  String out;
  for (int i = (LCD_COLS - static_cast<int>(text.length())) / 2; i > 0; --i) out += ' ';
  return out + text;
}

// Texto a la izquierda y valor pegado a la derecha: "Nivel 75%    25 L".
String twoCols(const String& left, const String& right) {
  String out = left;
  while (out.length() + right.length() < LCD_COLS) out += ' ';
  if (out.length() == left.length() && out.length() + right.length() >= LCD_COLS) out += ' ';
  return out + right;
}

String num(float value, uint8_t decimals) {
  char buf[16];
  dtostrf(value, 0, decimals, buf);
  return String(buf);
}

// La LCD no tiene tildes ni "ñ": los textos van sin ellas.
const char* levelStatus(float cm, float maxLevel) {
  if (cm >= cfg::OVERFLOW_LEVEL_CM) return "REBALSANDO";
  if (cm >= maxLevel) return "TANQUE LLENO";
  if (cm >= maxLevel - 5.0f) return "CASI LLENO";
  if (cm <= 2.0f) return "TANQUE VACIO";
  if (cm <= 5.0f) return "NIVEL BAJO";
  return "NIVEL NORMAL";
}

const char* phLabel(float ph) {
  if (ph < 6.5f) return "Acido";
  if (ph > 8.5f) return "Alcalino";
  return "Neutro";
}

const char* clarityLabel(float percent) {
  if (percent >= 80.0f) return "AGUA CLARA";
  if (percent >= 40.0f) return "POCO TURBIA";
  return "AGUA TURBIA";
}
}  // namespace

bool Display::present(uint8_t addr) const {
  Wire.beginTransmission(addr);
  return Wire.endTransmission() == 0;
}

uint8_t Display::scanAddress(bool fullScan) const {
  // Preferimos las direcciones habituales; al arrancar, también cualquier otro device.
  const uint8_t preferred[] = {LCD_I2C_ADDR, 0x3F, 0x20};
  for (uint8_t addr : preferred) {
    if (present(addr)) return addr;
  }
  if (!fullScan) return 0;
  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) return addr;
  }
  return 0;
}

void Display::begin() {
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  Wire.setTimeOut(20);  // un bus mal cableado no debe trabar el resto del programa
  if (!connect(true)) {
    Serial.println("[lcd] no se encontro pantalla I2C (se reintenta cada 5 s; SDA=D21, SCL=D22)");
  }
}

bool Display::connect(bool fullScan) {
  lastProbeMs_ = millis();
  const uint8_t address = scanAddress(fullScan);
  if (address == 0) return false;

  if (lcd_ == nullptr || address != address_) {
    delete lcd_;
    lcd_ = new LiquidCrystal_I2C(address, LCD_COLS, LCD_ROWS);
  }
  address_ = address;
  lcd_->init();
  lcd_->backlight();
  lcd_->clear();
  lcd_->setCursor(0, 0);
  lcd_->print(pad(center("RESERVORIO")));
  lcd_->setCursor(0, 1);
  lcd_->print(pad(center("DE AGUA")));

  ready_ = true;
  lastChangeMs_ = millis();
  Serial.printf("[lcd] pantalla en 0x%02X\n", address_);
  return true;
}

void Display::printLine(uint8_t row, const String& text) {
  if (lcd_ == nullptr) return;
  lcd_->setCursor(0, row);
  lcd_->print(pad(text));
}

void Display::mensaje(const String& linea1, const String& linea2, uint32_t ms) {
  mensaje_[0] = linea1;
  mensaje_[1] = linea2;
  mensajeHasta_ = millis() + ms;
  mensajePendiente_ = true;
}

void Display::update(const Sensors& sensors, const ConfigStore& config) {
  const uint32_t now = millis();
  if (ready_ && mensajeHasta_ != 0) {
    if (static_cast<int32_t>(mensajeHasta_ - now) > 0) {
      if (mensajePendiente_) {
        printLine(0, mensaje_[0]);
        printLine(1, mensaje_[1]);
        mensajePendiente_ = false;
      }
      return;
    }
    mensajeHasta_ = 0;
    lastChangeMs_ = now - kPageMs;  // al terminar, sigue con las páginas de inmediato
  }
  if (!ready_) {
    // Se puede conectar la pantalla con el ESP32 encendido.
    if (now - lastProbeMs_ >= kRetryMs) connect(false);
    return;
  }
  if (now - lastChangeMs_ < kPageMs) return;
  lastChangeMs_ = now;

  if (!present(address_)) {  // cable suelto: al volver se reinicia la pantalla
    ready_ = false;
    lastProbeMs_ = now;
    Serial.println("[lcd] pantalla desconectada");
    return;
  }

  // Muestra la siguiente página que tenga datos; si ningún sensor responde,
  // deja el nombre del proyecto en vez de valores vacíos.
  for (uint8_t tries = 0; tries < kPageCount; ++tries) {
    const uint8_t page = page_;
    page_ = (page_ + 1) % kPageCount;
    if (renderPage(page, sensors, config)) return;
  }
  printLine(0, center("RESERVORIO"));
  printLine(1, center("DE AGUA"));
}

bool Display::renderPage(uint8_t page, const Sensors& sensors, const ConfigStore& config) {
  if (lcd_ == nullptr) return false;

  switch (page) {
    case 0: {  // Nivel: porcentaje, litros y estado del tanque
      const float percent = sensors.levelPercent();
      const float cm = sensors.levelCm();
      if (isnan(percent) || isnan(cm)) return false;
      const float liters = sensors.liters();
      printLine(0, twoCols("Nivel " + num(percent, 0) + "%",
                           isnan(liters) ? String("") : num(liters, 0) + " L"));
      printLine(1, center(levelStatus(cm, config.maxLevelCm())));
      return true;
    }
    case 1: {  // Calidad: pH y temperatura
      const bool phOk = sensors.ph().ok() && !isnan(sensors.ph().ph());
      const bool tempOk = sensors.temperature().ok() && !isnan(sensors.temperature().celsius());
      if (!phOk && !tempOk) return false;
      String lines[2];
      uint8_t n = 0;
      if (phOk) lines[n++] = twoCols("pH " + num(sensors.ph().ph(), 1), phLabel(sensors.ph().ph()));
      if (tempOk) {
        lines[n++] = twoCols("Temp.",
                             num(sensors.temperature().celsius(), 1) + String(static_cast<char>(0xDF)) + "C");
      }
      printLine(0, lines[0]);
      printLine(1, lines[1]);
      return true;
    }
    case 2: {  // Claridad del agua (turbidez en palabras simples)
      const float clarity = sensors.turbidity().clarityPercent();
      if (!sensors.turbidity().ok() || isnan(clarity)) return false;
      printLine(0, twoCols("Claridad", num(clarity, 0) + " %"));
      printLine(1, center(clarityLabel(clarity)));
      return true;
    }
    case 4:  // Sin WiFi: cómo configurarlo desde el celular
      if (!redes::apActivo() || redes::conectado()) return false;
      printLine(0, cfg::AP_SSID);
      printLine(1, "Clave reservorio");
      return true;
    case 5:
      if (!redes::apActivo() || redes::conectado()) return false;
      printLine(0, "Abre en celular:");
      printLine(1, "192.168.4.1/wifi");
      return true;
    case 3:
    default: {  // Caudal de entrada y de salida
      printLine(0, twoCols("Entra", num(sensors.flowIn().litersPerMinute(), 1) + " L/min"));
      printLine(1, twoCols("Sale", num(sensors.flowOut().litersPerMinute(), 1) + " L/min"));
      return true;
    }
  }
}

#pragma once
#include <Arduino.h>

// ---------------------------------------------------------------------------
// Pines (ver docs/cableado.md)
// ---------------------------------------------------------------------------
#define PIN_TRIG           19
#define PIN_ECHO           18
#define PIN_FLOW           23
#define PIN_ONEWIRE         4
#define PIN_PH_ADC         34   // ADC1, solo entrada
#define PIN_TURB_ADC       35   // ADC1, solo entrada
#define PIN_I2C_SDA        21
#define PIN_I2C_SCL        22

#define LCD_I2C_ADDR     0x27
#define LCD_COLS           16
#define LCD_ROWS            2

// ---------------------------------------------------------------------------
// ADC
// ---------------------------------------------------------------------------
namespace cfg {
constexpr float ADC_MAX_COUNTS = 4095.0f;
constexpr float ADC_VREF       = 3.3f;

// Factor del divisor de tensión: 1.0 = sin divisor, 2.0 = divisor 4k7+4k7.
// Recomendado: alimentar los módulos a 5 V y dividir la salida a la mitad.
constexpr float PH_DIVIDER        = 2.0f;
constexpr float TURBIDITY_DIVIDER = 2.0f;

// ---------------------------------------------------------------------------
// Tanque (valores iniciales; se pueden cambiar desde la web y quedan en NVS)
// ---------------------------------------------------------------------------
constexpr float DEFAULT_TANK_HEIGHT_CM   = 100.0f;
constexpr float DEFAULT_SENSOR_OFFSET_CM = 0.0f;
constexpr float TANK_DIAMETER_CM         = 80.0f;  // para estimar litros
constexpr float MIN_VALID_DISTANCE_CM    = 2.0f;   // zona muerta del HC-SR04
constexpr float MAX_VALID_DISTANCE_CM    = 450.0f;

// ---------------------------------------------------------------------------
// Sensores
// ---------------------------------------------------------------------------
constexpr float DEFAULT_FLOW_PPL        = 450.0f;  // pulsos por litro (YF-S201)
constexpr float DEFAULT_PH_NEUTRAL_V    = 2.50f;   // voltaje en buffer pH 7
constexpr float DEFAULT_PH_SLOPE_V      = 0.18f;   // V por unidad de pH
constexpr float DEFAULT_TURB_CLEAR_V    = 4.20f;   // voltaje en agua clara

constexpr uint32_t LEVEL_INTERVAL_MS  = 1000;
constexpr uint32_t FLOW_INTERVAL_MS   = 1000;
constexpr uint32_t TEMP_INTERVAL_MS   = 1000;
constexpr uint32_t PH_INTERVAL_MS     = 500;
constexpr uint32_t TURB_INTERVAL_MS   = 500;
constexpr uint32_t FLOW_SAVE_MS       = 30000;   // cada cuánto persistir el total

constexpr uint32_t WIFI_TIMEOUT_MS    = 15000;
constexpr uint32_t WIFI_RETRY_MS      = 20000;

constexpr const char* AP_SSID = "Reservorio-Setup";
constexpr const char* AP_PASS = "reservorio";
constexpr const char* MDNS_HOST = "reservorio";
}  // namespace cfg

#pragma once
#include <Arduino.h>

// ---------------------------------------------------------------------------
// Pines (ver docs/cableado.md)
// ---------------------------------------------------------------------------
#define PIN_TRIG           19
#define PIN_ECHO           18
#define PIN_FLOW_IN        23   // caudalímetro de entrada (ZJ-S201 / YF-S201)
#define PIN_FLOW_OUT       26   // caudalímetro de salida
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
// Medidas reales (25/11/2026): interior 40 cm; el HC-SR04 ocupa de 36 a 38 cm. Con el
// tanque vacío mide 33.5 cm hasta el fondo (calibración "tanque vacío"): esa es la altura
// que se usa. El tanque llena a 30 cm, pero "lleno" se marca a 29 cm para dejar 1 cm de
// margen por la precisión del sensor. El rebose físico está a 31 cm.
constexpr float DEFAULT_TANK_HEIGHT_CM   = 33.5f;  // distancia medida con el tanque vacío
constexpr float DEFAULT_MAX_LEVEL_CM     = 29.0f;  // 100 % = TANQUE LLENO
constexpr float OVERFLOW_LEVEL_CM        = 31.0f;  // rebose físico -> REBALSANDO
constexpr float LEVEL_DEADBAND_CM        = 1.0f;   // menos de 1 cm de agua = vacío (ruido)
constexpr float DEFAULT_SENSOR_OFFSET_CM = 0.0f;
// Reservorio rectangular del plano Rev. 04 (medidas interiores)
constexpr float TANK_INTERNAL_LENGTH_CM  = 38.8f;
constexpr float TANK_INTERNAL_WIDTH_CM   = 28.8f;
constexpr float TANK_INTERNAL_HEIGHT_CM  = 40.0f;
constexpr float MIN_VALID_DISTANCE_CM    = 2.0f;   // zona muerta del HC-SR04
constexpr float MAX_VALID_DISTANCE_CM    = 450.0f;

// ---------------------------------------------------------------------------
// Sensores
// ---------------------------------------------------------------------------
constexpr float DEFAULT_FLOW_PPL        = 450.0f;  // pulsos por litro (YF-S201)
// pH: calibración del 25/11/2026 con pruebas/ph/monitor.py (voltaje de la salida Po):
// agua de caño pH 7.55 = 2.515 V y limón pH 2.2 = 3.353 V. Precisión aprox. ±0.3 pH.
constexpr float DEFAULT_PH_NEUTRAL_V    = 2.6015f; // voltaje en pH 7
constexpr float DEFAULT_PH_SLOPE_V      = 0.1565f; // V por unidad de pH (157 mV/pH)
// Turbidez: recalibrada el 26/11/2026 desde la web (divisor nuevo y lectura promediada:
// 16 lecturas del ADC + media recortada de ~7 s). Voltaje de la salida A, antes del divisor.
constexpr float DEFAULT_TURB_CLEAR_V    = 2.759f;  // agua de caño  -> 100 % de claridad
constexpr float DEFAULT_TURB_TURBID_V   = 2.225f;  // agua con tierra -> 0 % de claridad
constexpr float TURB_FORMULA_CLEAR_V    = 4.20f;   // agua clara en la curva NTU del fabricante

constexpr uint32_t LEVEL_INTERVAL_MS  = 70;     // un disparo del HC-SR04 (mínimo 60 ms entre disparos)
constexpr uint32_t FLOW_INTERVAL_MS   = 1000;
constexpr uint32_t TEMP_INTERVAL_MS   = 1000;
constexpr uint32_t PH_INTERVAL_MS     = 500;
constexpr uint32_t TURB_INTERVAL_MS   = 500;
constexpr uint32_t FLOW_SAVE_MS       = 30000;   // cada cuánto persistir el total
// A 30 L/min el sensor da 225 pulsos/s (uno cada 4.4 ms): un flanco a menos de 1 ms
// del anterior es ruido eléctrico y no se cuenta.
constexpr uint32_t FLOW_MIN_PULSE_US  = 1000;

constexpr uint32_t CLOUD_INTERVAL_MS  = 5000;    // envío a la nube (web en Vercel)
constexpr uint32_t CLOUD_HISTORY_MS   = 60000;   // un dato por minuto al historial

constexpr uint32_t WIFI_TIMEOUT_MS    = 15000;
constexpr uint32_t WIFI_RETRY_MS      = 20000;

constexpr const char* AP_SSID = "Reservorio-Setup";
constexpr const char* AP_PASS = "reservorio";
constexpr const char* MDNS_HOST = "reservorio";
constexpr uint16_t OTA_PORT = 3232;   // actualización por WiFi (ArduinoOTA / espota)
}  // namespace cfg

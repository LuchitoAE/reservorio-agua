/*
  Prueba de banco del sensor de pH PH-7BNC (PH-4502C) + ESP32 DevKit V1

  - Pin analógico: GPIO34 (ADC1, solo entrada).
  - Divisor 4.7k + 4.7k: al GPIO llega la mitad de la salida Po del módulo.
  - Módulo alimentado con 5 V (VIN). Do y To sin conectar.

  Cada 0.5 s envía una línea con datos crudos; los cálculos (voltaje de salida, pH,
  calibración con buffers y muestras) los hace el monitor de consola:

      ./.venv/bin/python pruebas/ph/monitor.py

  Formato de la línea:
      ph ms=<millis> raw=<ADC mediana> mv=<mV GPIO34 mediana> min=<mV> max=<mV> n=<muestras>
*/

#include <Arduino.h>

constexpr int PIN_PH = 34;
constexpr int NUM_MUESTRAS = 15;
constexpr uint32_t ESPERA_MUESTRA_MS = 10;
constexpr uint32_t PERIODO_MS = 500;

template <typename T>
void ordenar(T* datos, int n) {
  for (int i = 1; i < n; i++) {
    T valor = datos[i];
    int j = i - 1;
    while (j >= 0 && datos[j] > valor) {
      datos[j + 1] = datos[j];
      j--;
    }
    datos[j + 1] = valor;
  }
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  analogSetPinAttenuation(PIN_PH, ADC_11db);
  delay(500);

  Serial.println();
  Serial.println("# PH-7BNC prueba de banco: GPIO34, divisor x2, modulo a 5 V");
  Serial.println("# formato: ph ms=<t> raw=<adc> mv=<mV GPIO34> min=<mV> max=<mV> n=<muestras>");
  Serial.println("# monitor: ./.venv/bin/python pruebas/ph/monitor.py");
}

void loop() {
  const uint32_t inicio = millis();

  int crudos[NUM_MUESTRAS];
  uint32_t milivoltios[NUM_MUESTRAS];

  for (int i = 0; i < NUM_MUESTRAS; i++) {
    crudos[i] = analogRead(PIN_PH);
    // Voltaje con la calibración de fábrica del ADC (más exacto que raw * 3.3 / 4095).
    milivoltios[i] = analogReadMilliVolts(PIN_PH);
    delay(ESPERA_MUESTRA_MS);
  }

  ordenar(crudos, NUM_MUESTRAS);
  ordenar(milivoltios, NUM_MUESTRAS);

  Serial.printf("ph ms=%lu raw=%d mv=%lu min=%lu max=%lu n=%d\n",
                static_cast<unsigned long>(millis()),
                crudos[NUM_MUESTRAS / 2],
                static_cast<unsigned long>(milivoltios[NUM_MUESTRAS / 2]),
                static_cast<unsigned long>(milivoltios[0]),
                static_cast<unsigned long>(milivoltios[NUM_MUESTRAS - 1]),
                NUM_MUESTRAS);

  const uint32_t transcurrido = millis() - inicio;
  if (transcurrido < PERIODO_MS) delay(PERIODO_MS - transcurrido);
}

/*
  TS-300B + ESP32 DEVKIT V1
  Pin analogico: GPIO35
  Divisor: 4.7K + 4.7K
  Alimentacion del sensor: 5V

  Comandos seriales:
  c = Calibrar agua clara
  t = Calibrar agua turbia
*/

#include <Arduino.h>
#include <math.h>

#define PIN_TURBIDEZ 35

const int NUM_MUESTRAS = 9;
const float FACTOR_DIVISOR = 2.0;

// Referencias de calibracion
float referenciaClara = -1;
float referenciaTurbia = -1;

// Ordenar muestras para calcular mediana
void ordenar(float datos[], int n) {
  for (int i = 0; i < n - 1; i++) {
    for (int j = 0; j < n - i - 1; j++) {
      if (datos[j] > datos[j + 1]) {
        float temp = datos[j];
        datos[j] = datos[j + 1];
        datos[j + 1] = temp;
      }
    }
  }
}

void setup() {
  Serial.begin(115200);

  analogReadResolution(12);
  analogSetPinAttenuation(PIN_TURBIDEZ, ADC_11db);

  delay(1000);

  Serial.println("\n================================");
  Serial.println("   MONITOR TS-300B + ESP32");
  Serial.println("================================");
  Serial.println("Comandos disponibles:");
  Serial.println("c = Calibrar agua clara");
  Serial.println("t = Calibrar agua turbia");
  Serial.println("--------------------------------");
}

void loop() {

  float voltajes[NUM_MUESTRAS];
  int lecturas[NUM_MUESTRAS];

  float suma = 0;
  float minimo = 9999;
  float maximo = 0;

  // Capturar muestras
  for (int i = 0; i < NUM_MUESTRAS; i++) {

    lecturas[i] = analogRead(PIN_TURBIDEZ);

    // Voltaje calibrado del ADC en voltios
    voltajes[i] = analogReadMilliVolts(PIN_TURBIDEZ) / 1000.0;

    suma += voltajes[i];

    if (voltajes[i] < minimo)
      minimo = voltajes[i];

    if (voltajes[i] > maximo)
      maximo = voltajes[i];

    delay(30);
  }

  // Ordenar voltajes
  ordenar(voltajes, NUM_MUESTRAS);

  // Mediana de nueve muestras
  float medianaGPIO = voltajes[NUM_MUESTRAS / 2];

  // Reconstruir voltaje original del sensor
  float voltajeSensor = medianaGPIO * FACTOR_DIVISOR;

  // Calcular promedio y variacion
  float promedioGPIO = suma / NUM_MUESTRAS;

  float variacion = maximo - minimo;

  // Obtener ADC aproximado
  int adc = analogRead(PIN_TURBIDEZ);

  // Comandos de calibracion
  if (Serial.available()) {

    char comando = Serial.read();

    if (comando == 'c' || comando == 'C') {
      referenciaClara = voltajeSensor;

      Serial.println("\nAGUA CLARA CALIBRADA");
      Serial.print("Referencia: ");
      Serial.print(referenciaClara, 3);
      Serial.println(" V");
    }

    if (comando == 't' || comando == 'T') {
      referenciaTurbia = voltajeSensor;

      Serial.println("\nAGUA TURBIA CALIBRADA");
      Serial.print("Referencia: ");
      Serial.print(referenciaTurbia, 3);
      Serial.println(" V");
    }
  }

  // Indice relativo de claridad
  float claridad = -1;

  if (referenciaClara >= 0 &&
      referenciaTurbia >= 0 &&
      fabs(referenciaClara - referenciaTurbia) > 0.01) {

    claridad =
      ((voltajeSensor - referenciaTurbia) /
      (referenciaClara - referenciaTurbia)) * 100.0;

    claridad = constrain(claridad, 0, 100);
  }

  // Mostrar resultados
  Serial.println("\n========== TS-300B ==========");

  Serial.print("ADC: ");
  Serial.println(adc);

  Serial.print("Voltaje GPIO35: ");
  Serial.print(medianaGPIO, 3);
  Serial.println(" V");

  Serial.print("Voltaje salida A: ");
  Serial.print(voltajeSensor, 3);
  Serial.println(" V");

  Serial.print("Promedio GPIO: ");
  Serial.print(promedioGPIO, 3);
  Serial.println(" V");

  Serial.print("Minimo GPIO: ");
  Serial.print(minimo, 3);
  Serial.println(" V");

  Serial.print("Maximo GPIO: ");
  Serial.print(maximo, 3);
  Serial.println(" V");

  Serial.print("Variacion: ");
  Serial.print(variacion, 3);
  Serial.println(" V");

  if (claridad >= 0) {

    Serial.print("Indice de claridad: ");
    Serial.print(claridad, 1);
    Serial.println(" %");

  } else {

    Serial.println("Indice de claridad: SIN CALIBRAR");
  }

  Serial.println("=============================");

  delay(1000);
}

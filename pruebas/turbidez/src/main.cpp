#include <Arduino.h>

namespace {

constexpr uint8_t PIN_TURB = 35;
constexpr float ADC_MAX_COUNTS = 4095.0f;
constexpr float ADC_VREF = 3.3f;
constexpr float DIVIDER = 2.0f;       // divisor 4.7k + 4.7k
constexpr float CLEAR_REF_V = 4.20f;  // referencia de agua clara (sonda)
constexpr uint32_t PRINT_MS = 500;
constexpr uint8_t N = 5;

float history[N];
uint8_t histCount = 0;
uint8_t histIndex = 0;

void push(float v) {
  history[histIndex] = v;
  histIndex = (histIndex + 1) % N;
  if (histCount < N) histCount++;
}

float median() {
  float tmp[N];
  for (uint8_t i = 0; i < histCount; i++) tmp[i] = history[i];
  for (uint8_t i = 1; i < histCount; i++) {
    const float k = tmp[i];
    int8_t j = static_cast<int8_t>(i) - 1;
    while (j >= 0 && tmp[j] > k) {
      tmp[j + 1] = tmp[j];
      j--;
    }
    tmp[j + 1] = k;
  }
  return histCount ? tmp[histCount / 2] : NAN;
}

}  // namespace

void setup() {
  Serial.begin(115200);
  delay(400);

  analogReadResolution(12);
  analogSetPinAttenuation(PIN_TURB, ADC_11db);
  pinMode(PIN_TURB, INPUT);

  Serial.println();
  Serial.println("=== Test TS-300B (turbidez) ===");
  Serial.println("GPIO 35 · ADC 12 bits · divisor x2 · referencia 4.20 V");
  Serial.println("Sumerge la sonda hasta la marca; la electronica queda afuera.");
  Serial.println();
}

void loop() {
  static uint32_t last = 0;
  if (millis() - last < PRINT_MS) return;
  last = millis();

  const int raw = analogRead(PIN_TURB);
  const float pinV = (static_cast<float>(raw) / ADC_MAX_COUNTS) * ADC_VREF;
  const float sensorV = pinV * DIVIDER;
  push(sensorV);
  const float v = median();

  float ntu = -1120.4f * v * v + 5742.3f * v - 4352.9f;
  if (ntu < 0.0f) ntu = 0.0f;
  const float clarity = constrain((v / CLEAR_REF_V) * 100.0f, 0.0f, 100.0f);

  Serial.print("raw ");
  Serial.print(raw);
  Serial.print("   pin ");
  Serial.print(pinV, 3);
  Serial.print(" V   sonda ");
  Serial.print(v, 3);
  Serial.print(" V   NTU ");
  Serial.print(ntu, 0);
  Serial.print("   claridad ");
  Serial.print(clarity, 0);
  Serial.print(" %");

  if (raw <= 20) {
    Serial.print("   -> SIN LECTURA (revisar A / divisor)");
  } else if (raw >= 4075) {
    Serial.print("   -> ADC SATURADO (revisar divisor)");
  } else if (clarity >= 90.0f) {
    Serial.print("   -> AGUA CLARA");
  } else if (clarity >= 60.0f) {
    Serial.print("   -> TURBIDEZ LEVE");
  } else if (clarity >= 30.0f) {
    Serial.print("   -> TURBIA");
  } else {
    Serial.print("   -> MUY TURBIA");
  }
  Serial.println();
}

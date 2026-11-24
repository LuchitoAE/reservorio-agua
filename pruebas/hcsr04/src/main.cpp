#include <Arduino.h>

namespace {

constexpr uint8_t PIN_TRIG = 19;
constexpr uint8_t PIN_ECHO = 18;
constexpr uint32_t TIMEOUT_US = 25000;
constexpr float SOUND_CM_PER_US = 0.0343f;
constexpr float TANK_HEIGHT_CM = 36.5f;
constexpr uint32_t PRINT_MS = 1000;
constexpr uint32_t SAMPLE_GAP_MS = 60;

uint32_t lastPrint = 0;
float history[5];
uint8_t histCount = 0;
uint8_t histIndex = 0;
uint32_t okTotal = 0;
uint32_t failTotal = 0;

float measureOnce(unsigned long &dur) {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(3);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);
  dur = pulseIn(PIN_ECHO, HIGH, TIMEOUT_US);
  if (dur == 0) return NAN;
  const float cm = dur * SOUND_CM_PER_US / 2.0f;
  if (cm < 2.0f || cm > 450.0f) return NAN;
  return cm;
}

void pushHistory(float v) {
  history[histIndex] = v;
  histIndex = (histIndex + 1) % 5;
  if (histCount < 5) histCount++;
}

float median() {
  float tmp[5];
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
  pinMode(PIN_TRIG, OUTPUT);
  digitalWrite(PIN_TRIG, LOW);
  pinMode(PIN_ECHO, INPUT);

  Serial.println();
  Serial.println("=== Test HC-SR04 ===");
  Serial.println("TRIG = GPIO19   ECHO = GPIO18 (con divisor)");
  Serial.println("Calibracion 36.5 cm / nivel de operacion 30 cm");
  Serial.println();
}

void loop() {
  if (millis() - lastPrint < PRINT_MS) return;
  lastPrint = millis();

  uint8_t valid = 0;
  unsigned long durs[3] = {0, 0, 0};
  for (uint8_t i = 0; i < 3; i++) {
    const float v = measureOnce(durs[i]);
    if (!isnan(v)) {
      pushHistory(v);
      valid++;
    }
    delay(SAMPLE_GAP_MS);
  }

  okTotal += valid;
  failTotal += 3 - valid;

  if (valid == 0) {
    Serial.print("sin eco (0/3)  acumulado ");
    Serial.print(okTotal);
    Serial.print(" ok / ");
    Serial.print(failTotal);
    Serial.println(" fallos  -> revisar ECHO / divisor / alimentacion");
    return;
  }

  const float dist = median();
  const float level = TANK_HEIGHT_CM - dist;

  Serial.print("eco ");
  Serial.print(valid);
  Serial.print("/3   pulsos ");
  Serial.print(durs[0]);
  Serial.print("/");
  Serial.print(durs[1]);
  Serial.print("/");
  Serial.print(durs[2]);
  Serial.print(" us   distancia ");
  Serial.print(dist, 2);
  Serial.print(" cm   nivel ");
  Serial.print(level, 2);
  Serial.print(" cm   (");
  Serial.print(okTotal);
  Serial.print(" ok / ");
  Serial.print(failTotal);
  Serial.println(" fallos)");
}

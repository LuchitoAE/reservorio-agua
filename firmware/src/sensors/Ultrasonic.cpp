#include "sensors/Ultrasonic.h"

#include <algorithm>

#include "config.h"

namespace {
constexpr uint32_t kPulseTimeoutUs = 25000;  // ~4 m de alcance
constexpr float kSoundCmPerUs = 0.0343f;     // 343 m/s a 20 °C
constexpr uint8_t kFailsForNoEcho = 15;      // ~1 s seguido sin eco -> sensor no conectado
}  // namespace

void Ultrasonic::begin() {
  pinMode(PIN_TRIG, OUTPUT);
  digitalWrite(PIN_TRIG, LOW);
  pinMode(PIN_ECHO, INPUT);
}

float Ultrasonic::measureOnce() {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(3);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);

  const unsigned long duration = pulseIn(PIN_ECHO, HIGH, kPulseTimeoutUs);
  if (duration == 0) return NAN;  // sin eco

  const float cm = duration * kSoundCmPerUs / 2.0f;
  if (cm < cfg::MIN_VALID_DISTANCE_CM || cm > cfg::MAX_VALID_DISTANCE_CM) return NAN;
  return cm;
}

// Un disparo cada LEVEL_INTERVAL_MS (70 ms) sin bloquear el resto del programa;
// la distancia es la mediana de los últimos 5 ecos (~0.35 s), que descarta lecturas
// sueltas malas y responde rápido a los cambios de nivel.
float Ultrasonic::measureSteady() {
  float samples[25];
  uint8_t n = 0;
  const uint32_t start = millis();
  while (n < 25 && millis() - start < 2500) {
    const float d = measureOnce();
    if (!isnan(d)) samples[n++] = d;
    delay(70);  // el HC-SR04 necesita ~60 ms entre disparos
  }
  if (n < 10) return NAN;
  std::sort(samples, samples + n);
  return samples[n / 2];
}

void Ultrasonic::update() {
  const uint32_t now = millis();
  if (now - lastSampleMs_ < cfg::LEVEL_INTERVAL_MS) return;
  lastSampleMs_ = now;

  const float cm = measureOnce();
  if (isnan(cm)) {
    if (failStreak_ < 255) failStreak_++;
    if (failStreak_ >= kFailsForNoEcho) {
      ok_ = false;
      distanceCm_ = NAN;
      filter_.reset();
    }
    return;
  }

  failStreak_ = 0;
  filter_.push(cm);
  distanceCm_ = filter_.median();
  ok_ = !isnan(distanceCm_);
  lastReadMs_ = now;
}

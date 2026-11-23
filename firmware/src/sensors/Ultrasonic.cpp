#include "sensors/Ultrasonic.h"

#include "config.h"

namespace {
constexpr uint32_t kPulseTimeoutUs = 25000;  // ~4 m de alcance
constexpr float kSoundCmPerUs = 0.0343f;     // 343 m/s a 20 °C
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

void Ultrasonic::update() {
  const uint32_t now = millis();
  if (now - lastSampleMs_ < cfg::LEVEL_INTERVAL_MS) return;
  lastSampleMs_ = now;

  uint8_t valid = 0;
  for (uint8_t i = 0; i < 3; i++) {
    const float cm = measureOnce();
    if (!isnan(cm)) {
      filter_.push(cm);
      valid++;
    }
    delay(15);
  }

  if (valid == 0) {
    if (failStreak_ < 255) failStreak_++;
    if (failStreak_ >= 3) {
      ok_ = false;
      distanceCm_ = NAN;
      filter_.reset();
    }
    return;
  }

  failStreak_ = 0;
  distanceCm_ = filter_.median();
  ok_ = !isnan(distanceCm_);
  lastReadMs_ = now;
}

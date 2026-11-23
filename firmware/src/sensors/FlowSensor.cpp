#include "sensors/FlowSensor.h"

#include "ConfigStore.h"
#include "config.h"

FlowSensor* FlowSensor::instance_ = nullptr;

void ARDUINO_ISR_ATTR FlowSensor::isr() {
  if (instance_ != nullptr) instance_->pulsesTotal_++;
}

void FlowSensor::begin(ConfigStore* config) {
  config_ = config;
  pinMode(PIN_FLOW, INPUT_PULLUP);
  instance_ = this;

  totalLiters_ = config_ != nullptr ? config_->flowTotalL() : 0;
  // Reconstruye el contador de pulsos a partir de los litros persistidos para
  // que "pulsos" y "litros acumulados" sigan siendo coherentes tras un reinicio.
  const float ppl = config_ != nullptr ? config_->flowPulsesPerLiter() : cfg::DEFAULT_FLOW_PPL;
  pulsesTotal_ = static_cast<uint32_t>(lroundf(totalLiters_ * ppl));
  lastWindowPulses_ = pulsesTotal_;

  attachInterrupt(digitalPinToInterrupt(PIN_FLOW), FlowSensor::isr, FALLING);
  lastWindowMs_ = millis();
  lastSaveMs_ = lastWindowMs_;
}

void FlowSensor::update() {
  const uint32_t now = millis();
  const uint32_t elapsed = now - lastWindowMs_;
  if (elapsed < cfg::FLOW_INTERVAL_MS) return;

  noInterrupts();
  const uint32_t total = pulsesTotal_;
  interrupts();

  const uint32_t delta = total - lastWindowPulses_;
  lastWindowPulses_ = total;
  lastWindowMs_ = now;

  const float ppl = config_ != nullptr ? config_->flowPulsesPerLiter() : cfg::DEFAULT_FLOW_PPL;
  const float litersThisWindow = static_cast<float>(delta) / ppl;
  // L/min = litros en la ventana * (60000 / duración real)
  lpm_ = litersThisWindow * (60000.0f / static_cast<float>(elapsed));
  if (lpm_ < 0.02f) lpm_ = 0.0f;

  totalLiters_ += litersThisWindow;

  if (delta > 0) lastPulseMs_ = now;
  // No hay forma fiable de detectar un YF-S201 desconectado: la ausencia de pulsos
  // también significa "no hay caudal". Se considera operativo desde el arranque.
  ok_ = true;

  if (config_ != nullptr && now - lastSaveMs_ > cfg::FLOW_SAVE_MS) {
    config_->saveFlowTotalL(totalLiters_);
    lastSaveMs_ = now;
  }
}

void FlowSensor::resetTotal() {
  noInterrupts();
  pulsesTotal_ = 0;
  interrupts();
  totalLiters_ = 0;
  lastWindowPulses_ = 0;
  lastWindowMs_ = millis();
  if (config_ != nullptr) config_->saveFlowTotalL(0);
}

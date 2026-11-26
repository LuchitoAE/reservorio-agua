#include "sensors/FlowSensor.h"

#include "ConfigStore.h"
#include "config.h"

void ARDUINO_ISR_ATTR FlowSensor::isr(void* arg) {
  auto* self = static_cast<FlowSensor*>(arg);
  const uint32_t now = micros();
  if (now - self->lastEdgeUs_ < cfg::FLOW_MIN_PULSE_US) return;  // ruido
  self->lastEdgeUs_ = now;
  self->pulsesTotal_++;
}

void FlowSensor::begin(ConfigStore* config, uint8_t pin, uint8_t index) {
  config_ = config;
  pin_ = pin;
  index_ = index;
  // Pull-up interno: con el sensor desconectado el pin queda quieto en HIGH (sin pulsos).
  pinMode(pin_, INPUT_PULLUP);

  totalLiters_ = config_ != nullptr ? config_->flowTotalL(index_) : 0;
  savedLiters_ = totalLiters_;
  // Reconstruye el contador de pulsos a partir de los litros persistidos para
  // que "pulsos" y "litros acumulados" sigan siendo coherentes tras un reinicio.
  const float ppl = config_ != nullptr ? config_->flowPulsesPerLiter() : cfg::DEFAULT_FLOW_PPL;
  pulsesTotal_ = static_cast<uint32_t>(lroundf(totalLiters_ * ppl));
  lastWindowPulses_ = pulsesTotal_;

  attachInterruptArg(digitalPinToInterrupt(pin_), FlowSensor::isr, this, FALLING);
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

  // No hay forma fiable de detectar un caudalímetro desconectado: la ausencia de pulsos
  // también significa "no hay caudal". Se considera operativo desde el arranque.
  ok_ = true;

  // Guarda el acumulado solo si cambió (cuida la memoria flash).
  if (config_ != nullptr && now - lastSaveMs_ > cfg::FLOW_SAVE_MS) {
    lastSaveMs_ = now;
    if (totalLiters_ != savedLiters_) {
      config_->saveFlowTotalL(index_, totalLiters_);
      savedLiters_ = totalLiters_;
    }
  }
}

void FlowSensor::resetTotal() {
  noInterrupts();
  pulsesTotal_ = 0;
  interrupts();
  totalLiters_ = 0;
  savedLiters_ = 0;
  lastWindowPulses_ = 0;
  lastWindowMs_ = millis();
  if (config_ != nullptr) config_->saveFlowTotalL(index_, 0);
}

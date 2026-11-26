#pragma once
#include <Arduino.h>

/**
 * Filtro de mediana de tamaño fijo, sin asignación dinámica.
 * Sirve para descartar picos (ruido del ADC, ecos falsos, etc.).
 */
template <size_t N>
class MedianFilter {
 public:
  void push(float value) {
    if (isnan(value)) return;
    buf_[index_] = value;
    index_ = (index_ + 1) % N;
    if (count_ < N) count_++;
  }

  float median() const {
    if (count_ == 0) return NAN;
    float tmp[N];
    sorted(tmp);
    return tmp[count_ / 2];
  }

  // Promedio sin el 25 % más bajo ni el 25 % más alto: descarta picos como la mediana,
  // pero no salta entre dos valores cuando la lectura oscila (más estable).
  float trimmedMean() const {
    if (count_ == 0) return NAN;
    float tmp[N];
    sorted(tmp);
    const size_t drop = count_ / 4;
    float sum = 0;
    for (size_t i = drop; i < count_ - drop; i++) sum += tmp[i];
    return sum / static_cast<float>(count_ - 2 * drop);
  }

  float average() const {
    if (count_ == 0) return NAN;
    float sum = 0;
    for (size_t i = 0; i < count_; i++) sum += buf_[i];
    return sum / count_;
  }

  size_t count() const { return count_; }
  void reset() {
    index_ = 0;
    count_ = 0;
  }

 private:
  void sorted(float* tmp) const {
    for (size_t i = 0; i < count_; i++) tmp[i] = buf_[i];
    for (size_t i = 1; i < count_; i++) {
      const float key = tmp[i];
      int j = static_cast<int>(i) - 1;
      while (j >= 0 && tmp[j] > key) {
        tmp[j + 1] = tmp[j];
        j--;
      }
      tmp[j + 1] = key;
    }
  }

  float buf_[N] = {0};
  size_t index_ = 0;
  size_t count_ = 0;
};

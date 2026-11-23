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
    return tmp[count_ / 2];
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
  float buf_[N] = {0};
  size_t index_ = 0;
  size_t count_ = 0;
};

#include "ConfigStore.h"

#include <Preferences.h>

#include "config.h"

namespace {
Preferences prefs;
constexpr const char* kNamespace = "reserv";

constexpr const char* kTankHeight = "tankH";
constexpr const char* kMaxLevel = "maxLvl";
constexpr const char* kOffset = "offset";
// v2 (25/11/2026): voltaje con analogReadMilliVolts. Las claves viejas "phN"/"phS"
// usaban raw * 3.3 / 4095 (~10 % menos) y no son comparables, por eso se descartan.
constexpr const char* kPhNeutralOld = "phN";
constexpr const char* kPhSlopeOld = "phS";
constexpr const char* kPhNeutral = "phN2";
constexpr const char* kPhSlope = "phS2";
// v2 (25/11/2026): voltaje con analogReadMilliVolts. La clave vieja "turbC" usaba
// raw * 3.3 / 4095 (~10 % menos) y no es comparable, por eso se descarta.
constexpr const char* kTurbClearOld = "turbC";
constexpr const char* kTurbClear = "turbC2";
constexpr const char* kTurbTurbid = "turbT2";
constexpr const char* kFlowPpl = "flowPpl";
constexpr const char* kFlowTotal[2] = {"flowTot", "flowTotS"};  // entrada, salida
}  // namespace

void ConfigStore::begin() {
  prefs.begin(kNamespace, false);

  tankHeightCm_ = prefs.getFloat(kTankHeight, cfg::DEFAULT_TANK_HEIGHT_CM);
  maxLevelCm_ = prefs.getFloat(kMaxLevel, cfg::DEFAULT_MAX_LEVEL_CM);
  sensorOffsetCm_ = prefs.getFloat(kOffset, cfg::DEFAULT_SENSOR_OFFSET_CM);
  phNeutralV_ = prefs.getFloat(kPhNeutral, cfg::DEFAULT_PH_NEUTRAL_V);
  phSlopeV_ = prefs.getFloat(kPhSlope, cfg::DEFAULT_PH_SLOPE_V);
  turbClearV_ = prefs.getFloat(kTurbClear, cfg::DEFAULT_TURB_CLEAR_V);
  turbTurbidV_ = prefs.getFloat(kTurbTurbid, cfg::DEFAULT_TURB_TURBID_V);
  if (prefs.isKey(kTurbClearOld)) prefs.remove(kTurbClearOld);
  if (prefs.isKey(kPhNeutralOld)) prefs.remove(kPhNeutralOld);
  if (prefs.isKey(kPhSlopeOld)) prefs.remove(kPhSlopeOld);
  flowPpl_ = prefs.getFloat(kFlowPpl, cfg::DEFAULT_FLOW_PPL);
  for (uint8_t i = 0; i < 2; ++i) {
    flowTotalL_[i] = prefs.getFloat(kFlowTotal[i], 0.0f);
    if (isnan(flowTotalL_[i]) || flowTotalL_[i] < 0) flowTotalL_[i] = 0;
  }

  // Saneamiento por si la NVS quedó corrupta.
  if (tankHeightCm_ < 10 || tankHeightCm_ > 1000) tankHeightCm_ = cfg::DEFAULT_TANK_HEIGHT_CM;
  if (maxLevelCm_ < 5 || maxLevelCm_ > tankHeightCm_) maxLevelCm_ = min(cfg::DEFAULT_MAX_LEVEL_CM, tankHeightCm_);
  if (phNeutralV_ < 0.1f || phNeutralV_ > 5.0f) phNeutralV_ = cfg::DEFAULT_PH_NEUTRAL_V;
  if (phSlopeV_ < 0.01f || phSlopeV_ > 1.0f) phSlopeV_ = cfg::DEFAULT_PH_SLOPE_V;
  if (flowPpl_ < 50 || flowPpl_ > 5000) flowPpl_ = cfg::DEFAULT_FLOW_PPL;
  if (turbClearV_ < 0.2f || turbClearV_ > 5.0f) turbClearV_ = cfg::DEFAULT_TURB_CLEAR_V;
  if (turbTurbidV_ < 0.2f || turbTurbidV_ > 5.0f) turbTurbidV_ = cfg::DEFAULT_TURB_TURBID_V;
}

void ConfigStore::setTank(float heightCm, float offsetCm) {
  if (heightCm >= 10 && heightCm <= 1000) {
    tankHeightCm_ = heightCm;
    prefs.putFloat(kTankHeight, tankHeightCm_);
  }
  if (offsetCm >= -50 && offsetCm <= 50) {
    sensorOffsetCm_ = offsetCm;
    prefs.putFloat(kOffset, sensorOffsetCm_);
  }
  if (maxLevelCm_ > tankHeightCm_) {
    maxLevelCm_ = tankHeightCm_;
    prefs.putFloat(kMaxLevel, maxLevelCm_);
  }
}

void ConfigStore::setMaxLevel(float maxLevelCm) {
  if (maxLevelCm < 5) return;
  if (maxLevelCm > tankHeightCm_) maxLevelCm = tankHeightCm_;
  maxLevelCm_ = maxLevelCm;
  prefs.putFloat(kMaxLevel, maxLevelCm_);
}

void ConfigStore::setPhCalibration(float neutralV, float slopeV) {
  if (neutralV > 0.1f && neutralV < 5.0f) {
    phNeutralV_ = neutralV;
    prefs.putFloat(kPhNeutral, phNeutralV_);
  }
  if (slopeV > 0.01f && slopeV < 1.0f) {
    phSlopeV_ = slopeV;
    prefs.putFloat(kPhSlope, phSlopeV_);
  }
}

void ConfigStore::setTurbClearV(float volts) {
  if (volts > 0.2f && volts < 5.0f) {
    turbClearV_ = volts;
    prefs.putFloat(kTurbClear, turbClearV_);
  }
}

void ConfigStore::setTurbTurbidV(float volts) {
  if (volts > 0.2f && volts < 5.0f) {
    turbTurbidV_ = volts;
    prefs.putFloat(kTurbTurbid, turbTurbidV_);
  }
}

void ConfigStore::setFlowPulsesPerLiter(float ppl) {
  if (ppl >= 50 && ppl <= 5000) {
    flowPpl_ = ppl;
    prefs.putFloat(kFlowPpl, flowPpl_);
  }
}

void ConfigStore::saveFlowTotalL(uint8_t index, float liters) {
  if (index >= 2) return;
  if (liters < 0) liters = 0;
  flowTotalL_[index] = liters;
  prefs.putFloat(kFlowTotal[index], liters);
}

void ConfigStore::resetToDefaults() {
  tankHeightCm_ = cfg::DEFAULT_TANK_HEIGHT_CM;
  maxLevelCm_ = cfg::DEFAULT_MAX_LEVEL_CM;
  sensorOffsetCm_ = cfg::DEFAULT_SENSOR_OFFSET_CM;
  phNeutralV_ = cfg::DEFAULT_PH_NEUTRAL_V;
  phSlopeV_ = cfg::DEFAULT_PH_SLOPE_V;
  turbClearV_ = cfg::DEFAULT_TURB_CLEAR_V;
  turbTurbidV_ = cfg::DEFAULT_TURB_TURBID_V;
  flowPpl_ = cfg::DEFAULT_FLOW_PPL;

  prefs.putFloat(kTankHeight, tankHeightCm_);
  prefs.putFloat(kMaxLevel, maxLevelCm_);
  prefs.putFloat(kOffset, sensorOffsetCm_);
  prefs.putFloat(kPhNeutral, phNeutralV_);
  prefs.putFloat(kPhSlope, phSlopeV_);
  prefs.putFloat(kTurbClear, turbClearV_);
  prefs.putFloat(kTurbTurbid, turbTurbidV_);
  prefs.putFloat(kFlowPpl, flowPpl_);
}

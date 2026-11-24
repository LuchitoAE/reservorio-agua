#include "ConfigStore.h"

#include <Preferences.h>

#include "config.h"

namespace {
Preferences prefs;
constexpr const char* kNamespace = "reserv";

constexpr const char* kTankHeight = "tankH";
constexpr const char* kMaxLevel = "maxLvl";
constexpr const char* kOffset = "offset";
constexpr const char* kPhNeutral = "phN";
constexpr const char* kPhSlope = "phS";
constexpr const char* kTurbClear = "turbC";
constexpr const char* kFlowPpl = "flowPpl";
constexpr const char* kFlowTotal = "flowTot";
}  // namespace

void ConfigStore::begin() {
  prefs.begin(kNamespace, false);

  tankHeightCm_ = prefs.getFloat(kTankHeight, cfg::DEFAULT_TANK_HEIGHT_CM);
  maxLevelCm_ = prefs.getFloat(kMaxLevel, cfg::DEFAULT_MAX_LEVEL_CM);
  sensorOffsetCm_ = prefs.getFloat(kOffset, cfg::DEFAULT_SENSOR_OFFSET_CM);
  phNeutralV_ = prefs.getFloat(kPhNeutral, cfg::DEFAULT_PH_NEUTRAL_V);
  phSlopeV_ = prefs.getFloat(kPhSlope, cfg::DEFAULT_PH_SLOPE_V);
  turbClearV_ = prefs.getFloat(kTurbClear, cfg::DEFAULT_TURB_CLEAR_V);
  flowPpl_ = prefs.getFloat(kFlowPpl, cfg::DEFAULT_FLOW_PPL);
  flowTotalL_ = prefs.getFloat(kFlowTotal, 0.0f);

  // Saneamiento por si la NVS quedó corrupta.
  if (tankHeightCm_ < 10 || tankHeightCm_ > 1000) tankHeightCm_ = cfg::DEFAULT_TANK_HEIGHT_CM;
  if (maxLevelCm_ < 5 || maxLevelCm_ > tankHeightCm_) maxLevelCm_ = min(cfg::DEFAULT_MAX_LEVEL_CM, tankHeightCm_);
  if (phSlopeV_ < 0.01f || phSlopeV_ > 1.0f) phSlopeV_ = cfg::DEFAULT_PH_SLOPE_V;
  if (flowPpl_ < 50 || flowPpl_ > 5000) flowPpl_ = cfg::DEFAULT_FLOW_PPL;
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

void ConfigStore::setFlowPulsesPerLiter(float ppl) {
  if (ppl >= 50 && ppl <= 5000) {
    flowPpl_ = ppl;
    prefs.putFloat(kFlowPpl, flowPpl_);
  }
}

void ConfigStore::saveFlowTotalL(float liters) {
  if (liters < 0) liters = 0;
  flowTotalL_ = liters;
  prefs.putFloat(kFlowTotal, flowTotalL_);
}

void ConfigStore::resetToDefaults() {
  tankHeightCm_ = cfg::DEFAULT_TANK_HEIGHT_CM;
  maxLevelCm_ = cfg::DEFAULT_MAX_LEVEL_CM;
  sensorOffsetCm_ = cfg::DEFAULT_SENSOR_OFFSET_CM;
  phNeutralV_ = cfg::DEFAULT_PH_NEUTRAL_V;
  phSlopeV_ = cfg::DEFAULT_PH_SLOPE_V;
  turbClearV_ = cfg::DEFAULT_TURB_CLEAR_V;
  flowPpl_ = cfg::DEFAULT_FLOW_PPL;

  prefs.putFloat(kTankHeight, tankHeightCm_);
  prefs.putFloat(kMaxLevel, maxLevelCm_);
  prefs.putFloat(kOffset, sensorOffsetCm_);
  prefs.putFloat(kPhNeutral, phNeutralV_);
  prefs.putFloat(kPhSlope, phSlopeV_);
  prefs.putFloat(kTurbClear, turbClearV_);
  prefs.putFloat(kFlowPpl, flowPpl_);
}

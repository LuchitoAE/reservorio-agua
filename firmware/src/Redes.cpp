#include "Redes.h"

#include <DNSServer.h>
#include <WiFi.h>

#include <algorithm>
#include <vector>

#include "ConfigStore.h"
#include "config.h"
#include "secrets.h"

namespace {

struct Red {
  String ssid;
  String pass;
  bool casa;  // la red de secrets.h: usa la IP fija
};

struct Visible {
  String ssid;
  int32_t rssi;
  bool segura;
};

ConfigStore* gConfig = nullptr;
DNSServer gDns;
bool gAp = false;
int gIndice = -1;
String gIntentando;
String gPedido;               // red guardada desde la web, a la que hay que conectarse ya
uint32_t gUltimoIntentoMs = 0;
uint32_t gConectadoDesdeMs = 0;

std::vector<Visible> gEscaneo;
uint32_t gUltimoEscaneoMs = 0;
bool gEscaneando = false;

bool casaConfigurada() { return strlen(WIFI_SSID) > 0 && String(WIFI_SSID) != "TU_RED_WIFI"; }

std::vector<Red> conocidas() {
  std::vector<Red> v;
  if (gConfig != nullptr) {
    for (uint8_t i = 0; i < gConfig->wifiCount(); ++i) {
      if (gConfig->wifiSsid(i) != WIFI_SSID) v.push_back({gConfig->wifiSsid(i), gConfig->wifiPass(i), false});
    }
  }
  if (casaConfigurada()) v.push_back({WIFI_SSID, WIFI_PASS, true});
  return v;
}

// Red de la casa: IP fija de secrets.h. Cualquier otra red: la dirección que ella asigne.
void configurarIp(const Red& r) {
#ifdef WIFI_STATIC_IP
  if (r.casa) {
    IPAddress ip, gw, mask, dns;
    if (ip.fromString(WIFI_STATIC_IP) && gw.fromString(WIFI_GATEWAY) && mask.fromString(WIFI_SUBNET)) {
#ifdef WIFI_DNS
      if (!dns.fromString(WIFI_DNS)) dns = gw;
#else
      dns = gw;
#endif
      WiFi.config(ip, gw, mask, dns);
      return;
    }
  }
#endif
  WiFi.config(INADDR_NONE, INADDR_NONE, INADDR_NONE, INADDR_NONE);  // DHCP
}

void intentar(const Red& r) {
  WiFi.disconnect(false, false);
  configurarIp(r);
  WiFi.begin(r.ssid.c_str(), r.pass.c_str());
  gIntentando = r.ssid;
  gUltimoIntentoMs = millis();
  Serial.printf("[wifi] conectando a \"%s\" (%s)\n", r.ssid.c_str(), r.casa ? "IP fija" : "IP automatica");
}

bool esperar(uint32_t ms) {
  const uint32_t inicio = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - inicio < ms) delay(200);
  return WiFi.status() == WL_CONNECTED;
}

void abrirAp() {
  if (gAp) return;
  gAp = true;
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(cfg::AP_SSID, cfg::AP_PASS);
  gDns.start(53, "*", WiFi.softAPIP());  // portal: cualquier dirección lleva a la maqueta
  Serial.printf("[wifi] red de configuracion \"%s\" en http://%s/wifi\n", cfg::AP_SSID,
                WiFi.softAPIP().toString().c_str());
}

void cerrarAp() {
  if (!gAp) return;
  gDns.stop();
  WiFi.softAPdisconnect(true);
  WiFi.mode(WIFI_STA);
  gAp = false;
  Serial.println("[wifi] red de configuracion cerrada (ya hay WiFi)");
}

void actualizarEscaneo(bool forzar) {
  const int16_t r = WiFi.scanComplete();
  if (r >= 0) {
    gEscaneo.clear();
    for (int16_t i = 0; i < r; ++i) {
      const String ssid = WiFi.SSID(i);
      if (ssid.isEmpty()) continue;
      auto it = std::find_if(gEscaneo.begin(), gEscaneo.end(), [&](const Visible& v) { return v.ssid == ssid; });
      if (it == gEscaneo.end()) {
        gEscaneo.push_back({ssid, WiFi.RSSI(i), WiFi.encryptionType(i) != WIFI_AUTH_OPEN});
      } else if (WiFi.RSSI(i) > it->rssi) {
        it->rssi = WiFi.RSSI(i);
      }
    }
    std::sort(gEscaneo.begin(), gEscaneo.end(), [](const Visible& a, const Visible& b) { return a.rssi > b.rssi; });
    WiFi.scanDelete();
    gEscaneando = false;
    gUltimoEscaneoMs = millis();
  } else if (r == WIFI_SCAN_FAILED && (gUltimoEscaneoMs == 0 || millis() - gUltimoEscaneoMs > (forzar ? 12000 : 30000))) {
    // Como máximo una búsqueda cada 12 s aunque la página consulte seguido (buscar le quita
    // velocidad al WiFi).
    if (WiFi.scanNetworks(true) == WIFI_SCAN_RUNNING) gEscaneando = true;
  }
}

}  // namespace

namespace redes {

void begin(ConfigStore* config) {
  gConfig = config;
  WiFi.persistent(false);  // las claves se guardan en ConfigStore, no en la memoria interna del WiFi
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.setSleep(false);

  std::vector<Red> lista = conocidas();
  if (lista.empty()) {
    Serial.println("[wifi] sin redes conocidas");
    abrirAp();
    return;
  }

  // Primero las redes conocidas que están al alcance, de mejor a peor señal.
  const int16_t n = WiFi.scanNetworks();
  std::vector<std::pair<int32_t, Red>> orden;
  for (const Red& r : lista) {
    int32_t rssi = -1000;
    for (int16_t i = 0; i < n; ++i) {
      if (WiFi.SSID(i) == r.ssid) rssi = std::max(rssi, WiFi.RSSI(i));
    }
    orden.push_back({rssi, r});
  }
  WiFi.scanDelete();
  std::stable_sort(orden.begin(), orden.end(), [](const auto& a, const auto& b) { return a.first > b.first; });

  for (const auto& par : orden) {
    if (par.first == -1000) break;  // no está al alcance: se reintenta luego en segundo plano
    intentar(par.second);
    if (esperar(cfg::WIFI_TIMEOUT_MS)) {
      gConectadoDesdeMs = millis();
      Serial.printf("[wifi] OK \"%s\"  IP: %s  RSSI: %d dBm\n", WiFi.SSID().c_str(),
                    WiFi.localIP().toString().c_str(), WiFi.RSSI());
      return;
    }
  }
  Serial.println("[wifi] no conecto a ninguna red conocida");
  abrirAp();
}

void loop() {
  if (gAp) gDns.processNextRequest();
  if (gEscaneando) actualizarEscaneo(false);
  const uint32_t ahora = millis();

  // Red guardada desde la página /wifi: conectarse ya.
  if (!gPedido.isEmpty()) {
    for (const Red& r : conocidas()) {
      if (r.ssid == gPedido) {
        intentar(r);
        break;
      }
    }
    gPedido = "";
    return;
  }

  if (WiFi.status() == WL_CONNECTED) {
    if (gConectadoDesdeMs == 0) {
      gConectadoDesdeMs = ahora;
      Serial.printf("[wifi] OK \"%s\"  IP: %s\n", WiFi.SSID().c_str(), WiFi.localIP().toString().c_str());
    }
    // Con WiFi estable un minuto, se cierra la red de configuración.
    if (gAp && ahora - gConectadoDesdeMs > 60000) cerrarAp();
    return;
  }
  gConectadoDesdeMs = 0;

  if (ahora - gUltimoIntentoMs < cfg::WIFI_RETRY_MS) return;
  // Si alguien está en la red de configuración, no se interrumpe con reintentos.
  if (gAp && WiFi.softAPgetStationNum() > 0) {
    gUltimoIntentoMs = ahora;
    return;
  }
  const std::vector<Red> lista = conocidas();
  if (!lista.empty()) {
    gIndice = (gIndice + 1) % static_cast<int>(lista.size());
    intentar(lista[gIndice]);
  }
  if (!gAp && ahora > cfg::WIFI_TIMEOUT_MS + cfg::WIFI_RETRY_MS) abrirAp();
}

void estado(JsonDocument& doc) {
  actualizarEscaneo(true);
  const bool ok = WiFi.status() == WL_CONNECTED;
  doc["connected"] = ok;
  doc["ssid"] = ok ? WiFi.SSID() : String();
  doc["ip"] = ok ? WiFi.localIP().toString() : String();
  doc["rssi"] = ok ? WiFi.RSSI() : 0;
  doc["home"] = ok && WiFi.SSID() == WIFI_SSID;
  doc["trying"] = ok ? String() : gIntentando;
  doc["ap"] = gAp;
  doc["apSsid"] = cfg::AP_SSID;
  doc["apIp"] = gAp ? WiFi.softAPIP().toString() : String();
  doc["scanning"] = gEscaneando;

  JsonArray guardadas = doc["saved"].to<JsonArray>();
  if (casaConfigurada()) {
    JsonObject casa = guardadas.add<JsonObject>();
    casa["ssid"] = WIFI_SSID;
    casa["home"] = true;
  }
  if (gConfig != nullptr) {
    for (uint8_t i = 0; i < gConfig->wifiCount(); ++i) {
      if (gConfig->wifiSsid(i) == WIFI_SSID) continue;
      JsonObject r = guardadas.add<JsonObject>();
      r["ssid"] = gConfig->wifiSsid(i);
      r["home"] = false;
    }
  }
  JsonArray visibles = doc["networks"].to<JsonArray>();
  for (const Visible& v : gEscaneo) {
    JsonObject r = visibles.add<JsonObject>();
    r["ssid"] = v.ssid;
    r["rssi"] = v.rssi;
    r["secure"] = v.segura;
  }
}

bool guardar(const String& ssid, const String& pass) {
  if (gConfig == nullptr || ssid.isEmpty() || ssid.length() > 32) return false;
  if (!pass.isEmpty() && (pass.length() < 8 || pass.length() > 63)) return false;
  if (ssid != WIFI_SSID) gConfig->saveWifi(ssid, pass);
  gPedido = ssid;
  return true;
}

bool olvidar(const String& ssid) {
  if (gConfig == nullptr || ssid == WIFI_SSID) return false;
  return gConfig->forgetWifi(ssid);
}

bool apActivo() { return gAp; }
bool conectado() { return WiFi.status() == WL_CONNECTED; }

}  // namespace redes

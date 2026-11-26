#pragma once
#include <Arduino.h>
#include <ArduinoJson.h>

class ConfigStore;

/**
 * Conexión WiFi de la maqueta.
 *
 * - Redes conocidas: la de la casa (secrets.h) y hasta 3 guardadas desde la página /wifi
 *   (por ejemplo, el hotspot del celular). Al arrancar elige la conocida con mejor señal.
 * - Dirección: en la red de la casa usa la IP fija de secrets.h (192.168.2.200); en
 *   cualquier otra, la que le dé esa red (DHCP). La LCD muestra la red y la dirección.
 * - Si no hay ninguna red conocida, abre la red "Reservorio-Setup" (clave "reservorio") con
 *   un portal: al conectarse, el celular muestra la página para elegir el WiFi.
 */
namespace redes {

void begin(ConfigStore* config);
void loop();

void estado(JsonDocument& doc);                          // para GET /api/wifi
bool guardar(const String& ssid, const String& pass);    // guarda y se conecta
bool olvidar(const String& ssid);

bool apActivo();
bool conectado();

}  // namespace redes

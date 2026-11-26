#pragma once
#include <Arduino.h>

class ConfigStore;
class Sensors;

/**
 * Envío de la telemetría a la nube (Supabase) para la web publicada en Vercel.
 *
 * Cada 5 s el loop principal arma el JSON (igual al de /api/telemetry, sin datos de la red
 * WiFi) y una tarea en el núcleo 0 lo envía por HTTPS a la función ingest() de Supabase con
 * el token secreto del ESP32. Una vez por minuto se marca para guardarlo en el historial.
 * Se activa solo si secrets.h tiene CLOUD_URL, CLOUD_KEY y CLOUD_TOKEN (ver docs/nube.md).
 */
namespace cloud {

void begin();
void loop(const Sensors& sensors, const ConfigStore& config);
bool enabled();
String status();  // "off", "esperando", "ok" o "error <código>"

}  // namespace cloud

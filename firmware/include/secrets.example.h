#pragma once

// Copia este archivo como secrets.h y edítalo con los datos de tu red WiFi.
// Si no conecta en 15 s, el ESP32 crea la red de respaldo "Reservorio-Setup"
// (clave "reservorio") y publica el dashboard en http://192.168.4.1
// La red tiene que ser de 2.4 GHz (el ESP32 no usa 5 GHz).

#define WIFI_SSID "TU_RED_WIFI"
#define WIFI_PASS "TU_CLAVE_WIFI"

// IP fija (opcional). Sin estas líneas el router asigna la IP (DHCP).
// #define WIFI_STATIC_IP "192.168.1.200"
// #define WIFI_GATEWAY   "192.168.1.1"
// #define WIFI_SUBNET    "255.255.255.0"
// #define WIFI_DNS       "192.168.1.1"

// Clave para actualizar el firmware por WiFi (OTA) con ./tools/ota.sh.
// Sin esta línea la actualización por WiFi queda desactivada.
// #define OTA_PASSWORD "una-clave-larga"

// Nube (opcional): la web publicada en Vercel lee los datos desde Supabase.
// Pasos en docs/nube.md. CLOUD_URL y CLOUD_KEY son públicos (URL del proyecto y clave
// publishable/anon); CLOUD_TOKEN es SECRETO (en Supabase solo se guarda su hash SHA-256).
// #define CLOUD_URL   "https://xxxxxxxx.supabase.co"
// #define CLOUD_KEY   "sb_publishable_xxxxxxxx"
// #define CLOUD_TOKEN "una-clave-larga-y-aleatoria"

#!/usr/bin/env bash
# Actualiza el ESP32 por WiFi (OTA), sin cable USB.
#
#   ./tools/ota.sh            sube el firmware
#   ./tools/ota.sh uploadfs   sube los archivos de la web (antes: node tools/sync-web.js)
#
# Lee la IP (WIFI_STATIC_IP) y la clave (OTA_PASSWORD) de firmware/include/secrets.h.
# Para otra dirección: RESERVORIO_HOST=reservorio.local ./tools/ota.sh
# La primera vez hay que cargar el firmware por USB (ese firmware trae la función OTA).
set -euo pipefail
cd "$(dirname "$0")/.."

secrets="firmware/include/secrets.h"
[ -f "$secrets" ] || { echo "No existe $secrets (copia secrets.example.h)." >&2; exit 1; }

valor() { sed -n "s/^#define $1 \"\\(.*\\)\".*/\\1/p" "$secrets" | head -n1; }

clave="$(valor OTA_PASSWORD)"
[ -n "$clave" ] || { echo "Falta OTA_PASSWORD en $secrets." >&2; exit 1; }

ip_fija="$(valor WIFI_STATIC_IP)"
host="${RESERVORIO_HOST:-${ip_fija:-reservorio.local}}"
objetivo="${1:-upload}"

echo "Actualizando por WiFi ($objetivo) -> $host"
RESERVORIO_HOST="$host" RESERVORIO_OTA_PASS="$clave" \
  ./tools/pio.sh run -d firmware -e ota -t "$objetivo"

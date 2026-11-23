#!/usr/bin/env bash
# Ejecuta PlatformIO usando el entorno virtual del proyecto si existe.
set -e
cd "$(dirname "$0")/.."

if [ -x ".venv/bin/pio" ]; then
  exec .venv/bin/pio "$@"
elif command -v pio >/dev/null 2>&1; then
  exec pio "$@"
elif command -v platformio >/dev/null 2>&1; then
  exec platformio "$@"
else
  echo "PlatformIO no está instalado." >&2
  echo "Ejecuta:  python3 -m venv .venv && .venv/bin/pip install platformio" >&2
  exit 1
fi

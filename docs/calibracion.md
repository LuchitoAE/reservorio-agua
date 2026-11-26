# Calibración

Todos los parámetros se guardan en la memoria NVS del ESP32 (sobreviven a reinicios y
actualizaciones de firmware) y se pueden ver/editar desde el dashboard o con `curl`.

Valores por defecto en `firmware/include/config.h`.

---

## 1. Nivel (HC-SR04)

1. La altura de calibración es la distancia desde la **cara del sensor hasta el fondo** del
   tanque. Medido el 25/11/2026: el sensor ocupa de 36 a 38 cm, así que su cara queda a
   **36 cm** de los 40 cm interiores. Ponla en *Ajustes → Altura de calibración*.
2. El tanque llena a 30 cm, pero el **nivel máximo (100 % = TANQUE LLENO) es 29 cm**: deja
   1 cm de margen por la precisión del sensor. El rebose físico está a **31 cm** (desde ahí
   el dashboard, la LCD y el modelo muestran ¡REBALSANDO!). Llena el tanque y anota lo que
   muestra el dashboard.
3. Ajusta `sensorOffsetCm` para que marque el 100 %. Fórmula:

   ```
   nivel_cm = altura_calibración − distancia_leida − offset
   ```

   Si marca 97 % con el tanque lleno, el offset es negativo (el sensor está más cerca del
   agua de lo esperado) o hay que corregir la altura. Empieza validando la altura.
4. Comprueba con una cinta métrica a 25 %, 50 % y 75 %. La tolerancia esperada es ±1 cm.

Recomendaciones:

- Superficie del agua agitada → el eco se dispersa. Añade un tubo de PVC de 5 cm de diámetro
  como guía bajo el sensor.
- Si el tanque es metálico, el sensor debe quedar al menos 10 cm dentro del borde para no
  rebotar en la pared.

---

## 2. pH (PH-7BNC)

Calibración de **dos puntos** con buffers comerciales (4.00 y 7.00, o 7.00 y 10.00).

1. Enjuaga el electrodo con agua destilada y sécalo suavemente (sin frotar).
2. Sumérgelo en el buffer **7.00**, agita y espera 60 s a que se estabilice.
3. En el dashboard pulsa **Calibrar pH 7** (o `POST /api/calibrate {"sensor":"ph7"}`).
   El firmware promedia 20 lecturas y guarda el voltaje de neutro.
4. Enjuaga, sumerge en el buffer **4.00**, espera y pulsa **Calibrar pH 4**.
   Con los dos puntos se calcula la pendiente (mV/pH) automáticamente.
5. Verifica volviendo al buffer 7: debe leer 7.00 ± 0.1.

Notas:

- El módulo tiene dos potenciómetros (offset y pendiente). Si tras calibrar por software el
  pH 7 no se acerca a 7.00, gira el potenciómetro de **offset** hasta que la lectura caiga
  cerca y repite.
- Temperatura del agua: el electrodo cambia su pendiente ~0.2 %/°C. Para uso doméstico se
  ignora; si necesitas precisión, compensa con la lectura del DS18B20.
- Deriva típica: recalibra cada 4–8 semanas en uso continuo.

Fórmula implementada:

```
pH = 7.0 + (V_neutro − V_medido) / pendiente_V_por_pH
```

Valores guardados en el firmware (calibración del 25/11/2026 con `pruebas/ph/monitor.py`,
sin buffers de laboratorio):

| Referencia | pH | Salida Po |
| --- | --- | --- |
| Agua de caño | 7.55 | 2.515 V |
| Jugo de limón | 2.2 | 3.353 V |
| **Resultado** | | `V_neutro = 2.6015 V`, `pendiente = 0.1565 V/pH` (157 mV/pH) |

Precisión aproximada ±0.3 pH (limitada por el pH real del limón y del agua). Con buffers
comprados o con `bicarbonato` / `vinagre` se puede mejorar (ver `pruebas/ph/README.md`).

- El voltaje se lee con `analogReadMilliVolts`, igual que la prueba de banco, así que la
  calibración del monitor sirve tal cual. Claves NVS: `phN2` y `phS2` (las viejas `phN`/`phS`
  usaban otra escala y se borran al arrancar).
- El offset del módulo quedó ajustado: Po ≈ 2.5 V en agua de pH 7.55.

---

## 3. Turbidez (TS-300B)

Se calibra con **dos referencias**: agua clara (100 %) y agua turbia (0 %). El firmware
viene con las medidas el 25/11/2026 con la prueba de banco (`pruebas/turbidez/monitor.py`):

| Referencia | Voltaje (salida A) | Clave NVS |
| --- | --- | --- |
| Agua de caño | 2.89 V | `turbClearV` (`turbC2`) |
| Agua con tierra | 2.52 V | `turbTurbidV` (`turbT2`) |

Para recalibrar desde el dashboard:

1. Llena un vaso con agua potable limpia, a la misma temperatura del tanque.
2. Introduce el sensor hasta la marca, sin tocar las paredes, y espera 30–60 s.
3. Pulsa **Agua clara**. Se guarda `turbClearV`.
4. Repite con agua turbia (agua con tierra) y pulsa **Agua turbia**. Se guarda `turbTurbidV`.

Cálculos:

- Claridad: `(V − turbTurbidV) / (turbClearV − turbTurbidV) × 100`, limitada a 0–100 %.
- NTU (estimado): `Ve = V × 4.2 / turbClearV` y luego la curva del fabricante
  `−1120.4·Ve² + 5742.3·Ve − 4352.9`. Debajo de Ve = 2.5 V se informa 3000 NTU (tope).
- El voltaje se lee con `analogReadMilliVolts` (calibración de fábrica del ADC), igual que
  la prueba de banco, así que los valores del monitor sirven tal cual en el firmware.

Si el agua clara marca un valor alto de NTU (>50), revisa:

- Burbujas adheridas al lente (golpea suavemente el sensor).
- Divisor de tensión mal calculado (el firmware espera `TURBIDITY_DIVIDER`).
- Alimentación por debajo de 5 V.

---

## 4. Flujo (YF-S201)

El valor de fábrica es **450 pulsos por litro**, ya configurado. Para verificarlo:

1. Llena un balde de 10 L cronometrando.
2. Compara los litros que reporta el dashboard.
3. Ajusta `flowPulsesPerLiter = 450 × (litros_reportados / litros_reales)`.

El caudal instantáneo se calcula sobre ventanas de 1 s; si el flujo es muy bajo (<0.5 L/min)
la lectura puede oscilar. El totalizador no se pierde al reiniciar la placa.

---

## 5. Cambiar parámetros por HTTP

```bash
# ver calibración actual
curl http://reservorio.local/api/config

# altura del tanque
curl -X POST http://reservorio.local/api/config \
  -H 'Content-Type: application/json' -d '{"tankHeightCm":120}'

# calibrar (con el sensor ya en el buffer)
curl -X POST http://reservorio.local/api/calibrate \
  -H 'Content-Type: application/json' -d '{"sensor":"ph7"}'

# reiniciar totalizador de flujo
curl -X POST http://reservorio.local/api/reset \
  -H 'Content-Type: application/json' -d '{"what":"flow"}'
```

# Calibración

Todos los parámetros se guardan en la memoria NVS del ESP32 (sobreviven a reinicios y
actualizaciones de firmware) y se pueden ver/editar desde el dashboard o con `curl`.

Valores por defecto en `firmware/include/config.h`.

---

## 1. Nivel (HC-SR04)

1. Mide la **altura interior** del tanque desde el fondo hasta el sensor (cm) y ponla en
   *Ajustes → Altura del tanque*. Para el reservorio del plano Rev. 04 son **40.6 cm** de
   altura total y **31.5 cm** de nivel máximo (rebose).
2. Con el tanque **lleno hasta el rebosadero**, anota el nivel que muestra el dashboard.
3. Ajusta `sensorOffsetCm` para que marque el 100 %. Fórmula:

   ```
   nivel_cm = altura_tanque − distancia_leida − offset
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

Por defecto `V_neutro = 2.50 V`, `pendiente = 0.18 V/pH` (valores típicos del módulo a 5 V).

---

## 3. Turbidez (SEN0189)

La fórmula NTU es una aproximación del fabricante. Lo importante es la **referencia de agua
clara**:

1. Llena un vaso con agua destilada o potable limpia, a la misma temperatura del tanque.
2. Introduce el sensor hasta la marca, sin tocar las paredes, y espera 30 s.
3. Pulsa **Calibrar agua clara**. Se guarda el voltaje de referencia (`turbClearV`).
4. El % de claridad se calcula como `V / turbClearV × 100`.

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

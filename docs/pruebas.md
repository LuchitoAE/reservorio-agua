# Plan de pruebas

Marca cada casilla a medida que avanzas. Orden pensado para detectar problemas de hardware
antes de mezclar sensores.

## Fase 0 — Banco de pruebas (sin agua)

- [ ] ESP32 conectado por USB, `pio device monitor` muestra el arranque y la IP.
- [ ] `http://reservorio.local` (o la IP) carga el dashboard.
- [ ] Sin sensores conectados, el dashboard muestra cada tarjeta en estado `sin lectura`
      sin romperse ni bloquearse.
- [ ] El LED de la placa y la web responden con el ESP32 alimentado solo por USB.

## Fase 1 — Sensor por sensor

### HC-SR04
- [ ] Con el sensor sobre la mesa, la distancia mostrada coincide con una cinta métrica (±1 cm).
- [ ] Al acercar la mano, el nivel sube; al alejarla, baja.
- [ ] A 200 cm sigue midiendo; a menos de 5 cm marca el mínimo (zona muerta).
- [ ] Sin obstáculo (eco perdido), la tarjeta queda en `sin lectura`, no en un valor absurdo.

### YF-S201
- [ ] Soplar suavemente por la entrada gira el rotor y el caudal se incrementa.
- [ ] 1 L medido con jarra ≈ 1.0 L acumulado (±5 %).
- [ ] Al cerrar el flujo, L/min vuelve a 0 en ~2 s.
- [ ] El total no se reinicia al desconectar el USB.

### DS18B20
- [ ] Temperatura ambiente ≈ la de un termómetro cercano (±0.5 °C).
- [ ] Al sujetar la sonda con la mano, la lectura sube lentamente.
- [ ] Al desconectar DATA, la tarjeta pasa a error y se recupera al reconectar.

### PH-7BNC
- [ ] En buffer 7.00 → lectura 7.0 ± 0.1 tras calibrar.
- [ ] En buffer 4.00 → lectura 4.0 ± 0.15.
- [ ] El voltaje mostrado en diagnóstico se mueve al cambiar de buffer.
- [ ] Lectura estable (sin saltos >0.2 pH entre muestras).

### SEN0189
- [ ] En agua clara, NTU bajo (<30) y claridad >80 %.
- [ ] Al añadir unas gotas de leche/tierra, NTU sube y claridad baja.
- [ ] El voltaje del diagnóstico nunca supera 3.3 V en el pin (¡medir con multímetro!).

### LCD 1602
- [ ] Muestra las 5 páginas rotando cada 2.5 s.
- [ ] Se lee sin caracteres basura; contraste ajustado con el potenciómetro del backpack.

## Fase 2 — Integración

- [ ] Los 5 sensores conectados a la vez: sin reinicios ni caídas de WiFi.
- [ ] 30 minutos de funcionamiento continuo: sin *watchdog reset* en el monitor serie.
- [ ] La web responde en menos de 1 s con todos los sensores activos.
- [ ] Celular y PC conectados al mismo tiempo: ambos ven los datos.
- [ ] Reinicio eléctrico: los totales y la calibración se conservan.
- [ ] Desconectar el router: el ESP32 levanta `Reservorio-Setup` y sirve la web.

## Fase 3 — Prueba con agua

- [ ] Llenado real: nivel 25/50/75/100 % comparado con cinta métrica.
- [ ] Entrada de agua: caudal coherente con el tiempo de llenado.
- [ ] Temperatura del agua estable tras 10 min de inmersión.
- [ ] pH del agua de red dentro de 6.5–8.5.
- [ ] Turbidez antes/después de dejar reposar el agua (debe bajar).
- [ ] 24 h continuas con el tanque: sin lecturas congeladas ni picos raros.

## Problemas frecuentes

| Síntoma | Causa probable |
| --- | --- |
| Todo en `sin lectura` | La web del ESP32 no está subida (`uploadfs`) o el JSON falla |
| Nivel siempre 0 | ECHO sin divisor / TRIG y ECHO invertidos |
| pH pegado a 0 o 14 | Entrada saturada (>3.3 V) o divisor mal configurado |
| Turbidez siempre 0 % | Falta el divisor o `TURBIDITY_DIVIDER` incorrecto |
| Flujo no cuenta | Falta pull-up en la señal o sensor en la salida equivocada |
| DS18B20 en `-127 °C` | Falta la resistencia de 4.7 kΩ o cable invertido |
| WiFi se cae con lecturas | Fuente insuficiente: usa 5 V externa |
| LCD en blanco | Dirección I2C distinta de `0x27` o contraste |

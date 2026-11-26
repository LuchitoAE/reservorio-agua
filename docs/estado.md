# Estado del proyecto

Actualizado: **25 de noviembre de 2026**. El detalle técnico para agentes está en
[`../AGENTS.md`](../AGENTS.md).

## Resumen

| Área | Estado |
| --- | --- |
| Firmware | Compila; tanque rectangular, calibración 36 cm, lleno 29 cm y rebose 31 cm |
| Placa | Conectada; tiene el firmware del proyecto y la web (25/11/2026) |
| LCD 1602 | Verificado (0x27) |
| DS18B20 | Verificado (1 dispositivo, ~20.5 °C) |
| HC-SR04 | Verificado en protoboard (3/3 ecos); falta montarlo |
| Turbidez | Calibrado (TS-300B): agua de caño 2.89 V = 100 %, agua con tierra 2.52 V = 0 %. Revisar cables: ahora lee ~0 V |
| pH | Calibrado con agua (pH 7.55) y limón (pH 2.2): neutro 2.60 V, 157 mV/pH, ±0.3 pH aprox. |
| Caudal | Pendiente |
| Dashboard web | Verificado en escritorio y móvil |
| Modelo 3D | **Aprobado para la fase 1** |
| Informe DOCX | Generado y validado (35 páginas) |
| WiFi | Conectado a la red de la casa (`http://reservorio.local`) |

## Modelo digital 3D

El modelo se considera **cerrado en su versión MVP** con el trazado de tuberías aprobado el
24/11/2026. Representa el plano Rev. 04:

- Tanque de vidrio 40 × 30 cm, interior 40 cm (exterior 41 con base); caseta 22 × 20 × 26 cm.
- Lleno a 29 cm (el tanque llena a 30; 1 cm de margen); rebose 31 cm; cara del sensor a 36 cm (ocupa 36–38 cm).
- Entrada y salida en paralelo a 5.5 cm; la pareja a la derecha visto desde atrás.
- Entrada con válvula abajo, subida junto al tanque y codo corto de 1 cm hacia abajo.
- Paso directo con válvula apenas entra la acometida.
- Salida del tanque con válvula a la misma altura.
- Limpia con válvula cerca del tanque.
- Acabado realista: codos, tees, uniones universales, pasamuros, canastilla y válvulas de bola con cuerpo y palanca rojos.
- Rebose sin válvula, alineado con limpia y conectado a la mitad de esa línea.

No se requieren más cambios de trazado por ahora. Cualquier ajuste futuro debe pedirse
explícitamente.

## Pendiente inmediato

1. Reconectar el ESP32 por USB y flashear:
   - firmware nuevo (calibración 36 / lleno 29 / rebose 31 y volumen rectangular);
   - web con el modelo 3D (`uploadfs`).
2. Verificar el arranque y el nivel con el monitor serie.
3. Resolver el WiFi (clave, red de 2.4 GHz o WPA2) o dejarlo en modo AP.
4. Conectar y probar los sensores restantes.

## Trabajo futuro

- Fase 2: Vercel + Supabase, histórico y acceso remoto.
- Fase 3: versión realista del modelo (fotogrametría o `.glb`) y corte dinámico.
- Operación: alertas, OTA y caja IP65.

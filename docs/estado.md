# Estado del proyecto

Actualizado: **24 de noviembre de 2026**. El detalle técnico para agentes está en
[`../AGENTS.md`](../AGENTS.md).

## Resumen

| Área | Estado |
| --- | --- |
| Firmware | Compila; incluye tanque rectangular 40.6 / 31.5 cm |
| Placa | **Desconectada**: falta flashear la versión nueva |
| LCD 1602 | Verificado (0x27) |
| DS18B20 | Verificado (1 dispositivo, ~20.5 °C) |
| HC-SR04, caudal, pH, turbidez | Pendientes de conectar |
| Dashboard web | Verificado en escritorio y móvil |
| Modelo 3D | **Aprobado para la fase 1** |
| Informe DOCX | Generado y validado (33 páginas) |
| WiFi | No conecta; queda en AP `Reservorio-Setup` (192.168.4.1) |

## Modelo digital 3D

El modelo se considera **cerrado en su versión MVP** con el trazado de tuberías aprobado el
24/11/2026. Representa el plano Rev. 04:

- Tanque de vidrio 40 × 30 × 40.6 cm, vidrio 6 mm, caseta 22 × 20 × 26 cm.
- Entrada y salida en paralelo a 5.5 cm; la pareja a la derecha visto desde atrás.
- Entrada con válvula abajo, subida junto al tanque y codo corto de 1 cm hacia abajo.
- Paso directo con válvula apenas entra la acometida.
- Salida del tanque con válvula a la misma altura.
- Limpia con válvula cerca del tanque.
- Rebose sin válvula, alineado con limpia y conectado a la mitad de esa línea.

No se requieren más cambios de trazado por ahora. Cualquier ajuste futuro debe pedirse
explícitamente.

## Pendiente inmediato

1. Reconectar el ESP32 por USB y flashear:
   - firmware nuevo (tanque 40.6/31.5 y volumen rectangular);
   - web con el modelo 3D (`uploadfs`).
2. Verificar el arranque y el nivel con el monitor serie.
3. Resolver el WiFi (clave, red de 2.4 GHz o WPA2) o dejarlo en modo AP.
4. Conectar y probar los sensores restantes.

## Trabajo futuro

- Fase 2: Vercel + Supabase, histórico y acceso remoto.
- Fase 3: versión realista del modelo (fotogrametría o `.glb`) y corte dinámico.
- Operación: alertas, OTA y caja IP65.

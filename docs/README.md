# Documentación

Índice de los documentos del proyecto. Si es tu primera vez, empieza por la guía paso a paso.

| Documento | Para qué sirve | Cuándo usarlo |
| --- | --- | --- |
| [`estado.md`](estado.md) | Estado actual, decisiones y pendientes del proyecto | Para retomar el trabajo |
| [`guia-paso-a-paso.md`](guia-paso-a-paso.md) | Montaje completo en protoboard, sin soldar, con una prueba después de cada sensor | Al empezar, de cero |
| [`cableado.md`](cableado.md) | Detalle eléctrico: pines, divisores, alimentación y notas de montaje | Mientras conectas cables |
| [`calibracion.md`](calibracion.md) | Procedimientos de calibración de nivel, pH, turbidez y caudal | Cuando los sensores ya funcionan |
| [`pruebas.md`](pruebas.md) | Plan de pruebas con casillas y criterios de aceptación | Antes de instalar en el tanque |
| [`roadmap.md`](roadmap.md) | Fases futuras: Vercel + Supabase, modelo 3D, alertas y OTA | Para planificar lo siguiente |
| [`../web/modelo.html`](../web/modelo.html) | Modelo 3D interactivo del tanque y la caseta | Para ver el nivel en 3D |
| [`planos/reservorio-rev04.pdf`](planos/reservorio-rev04.pdf) | Plano técnico del reservorio y la caseta (Rev. 04) | Fuente de las medidas del modelo |
| [`../Informe-Reservorio-Agua.docx`](../Informe-Reservorio-Agua.docx) | Informe técnico completo, listo para imprimir o compartir | Para entregar o consultar todo en uno |

## Qué hay en cada parte del repositorio

- `docs/img/` — diagramas y capturas usadas por la documentación y el informe.
- `firmware/` — código del ESP32; `firmware/include/config.h` es el punto de partida.
- `web/` — dashboard; se puede abrir en el navegador con `node tools/dev-server.js`.
- `tools/` — servidor local, sincronización de la web y generador del informe.

## Orden de lectura recomendado

1. `README.md` de la raíz (visión general e inicio rápido).
2. `guia-paso-a-paso.md` (montaje).
3. `cableado.md` mientras conectas.
4. `calibracion.md` y `pruebas.md` cuando ya hay lecturas.
5. `roadmap.md` para lo que sigue.

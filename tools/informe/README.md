# Documentos Word del proyecto

Genera, sin código en el contenido:

- `Informe-Reservorio-Agua.docx` — reporte de lo que se hizo.
- `docs/Conexion-de-sensores.docx` — conexión de los sensores, cable por cable.

```bash
./.venv/bin/python tools/informe/diagramas.py   # SVG de conexiones y arquitectura (si cambian)
./.venv/bin/python tools/informe/generar.py     # los dos .docx
```

- `estilo.py`: formato común (portada, títulos, tablas, recuadros, figuras).
- `generar.py`: el texto de los dos documentos.
- `diagramas.py`: diagramas en SVG; los PNG se obtienen con un navegador sin ventana
  (por ejemplo `brave --headless=new --screenshot=... file://.../conexiones.svg`).
- Las capturas de la web están en `docs/img/captura-*.png`.

Para revisar el resultado como PDF:
`flatpak run org.libreoffice.LibreOffice --headless --convert-to pdf Informe-Reservorio-Agua.docx`.

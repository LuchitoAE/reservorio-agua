# Generador del informe

Este directorio construye `Informe-Reservorio-Agua.docx` a partir del contenido en
`contenido.py` y de las imágenes en `docs/img/`.

## Requisitos

```bash
./.venv/bin/pip install -r tools/informe/requirements.txt
```

También necesita un conversor de DOCX a PDF para calcular las páginas del índice:

- LibreOffice (`soffice` o el flatpak `org.libreoffice.LibreOffice`), o
- OnlyOffice `x2t` en `/opt/onlyoffice/desktopeditors/converter/x2t`.

Si no hay conversor, el documento se genera igual, pero el índice queda sin números de página.

## Generar

```bash
./.venv/bin/python tools/informe/generar.py
```

El resultado se guarda en la raíz como `Informe-Reservorio-Agua.docx`. El script hace dos
pasadas: la primera mide la paginación real y la segunda escribe el índice con los números
correctos. Al final imprime la ruta de un PDF de control.

## Editar el contenido

- `contenido.py` — lista de bloques: títulos, párrafos, listas, tablas, imágenes, código y avisos.
- `formato.py` — estilos, portada, tablas, figuras y encabezado/pie.
- `generar.py` — armado, índice y verificación.

Los tipos de bloque disponibles son `h1`, `h2`, `h3`, `p`, `lista`, `numeros`, `checklist`,
`tabla`, `imagen`, `codigo`, `callout` y `parte`. Las tablas y figuras se numeran
automáticamente.

Si cambias las capturas del dashboard, reemplaza los archivos de `docs/img/` y vuelve a
generar. Las imágenes se renderizan desde los SVG que están en la misma carpeta.

#!/usr/bin/env python3
"""Genera el informe DOCX del proyecto Reservorio de Agua.

Uso:
    ./.venv/bin/python tools/informe/generar.py

Hace dos pasadas: la primera calcula las páginas reales convirtiendo a PDF y la
segunda escribe el índice con esos números.
"""

import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import contenido as C  # noqa: E402
import formato as F  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SALIDA = ROOT / 'Informe-Reservorio-Agua.docx'
X2T = Path('/opt/onlyoffice/desktopeditors/converter/x2t')
FRASE_INICIO = 'Este documento describe cómo conectar'


def comando_soffice():
    for nombre in ('soffice', 'libreoffice'):
        ruta = shutil.which(nombre)
        if ruta:
            return [ruta]
    if shutil.which('flatpak'):
        info = subprocess.run(
            ['flatpak', 'info', 'org.libreoffice.LibreOffice'],
            capture_output=True,
        )
        if info.returncode == 0:
            return [
                'flatpak', 'run', '--filesystem=/tmp',
                '--command=/app/libreoffice/program/soffice',
                'org.libreoffice.LibreOffice',
            ]
    return None


def convertir_pdf(docx_path, pdf_path):
    comando = comando_soffice()
    if comando:
        perfil = Path(tempfile.gettempdir()) / 'lo-profile-informe'
        argumentos = comando + [
            '--headless', '--norestore',
            f'-env:UserInstallation=file://{perfil}',
            '--convert-to', 'pdf',
            '--outdir', str(docx_path.parent),
            str(docx_path),
        ]
        subprocess.run(
            argumentos, check=True, capture_output=True, timeout=240,
        )
        generado = docx_path.parent / f'{docx_path.stem}.pdf'
        if generado != pdf_path:
            generado.replace(pdf_path)
    elif X2T.exists():
        subprocess.run(
            [str(X2T), str(docx_path), str(pdf_path)],
            check=True, capture_output=True, timeout=180,
        )
    else:
        raise RuntimeError('No hay LibreOffice ni x2t para convertir a PDF')

    if not pdf_path.exists():
        raise RuntimeError('La conversión a PDF no generó el archivo')


def normalizar(texto):
    texto = unicodedata.normalize('NFKD', texto)
    texto = ''.join(c for c in texto if not unicodedata.combining(c))
    texto = texto.lower()
    texto = re.sub(r'[^a-z0-9áéíóúñü ]+', ' ', texto)
    return re.sub(r'\s+', ' ', texto).strip()


def entradas_indice():
    entradas = []
    for bloque in C.BLOQUES:
        if bloque[0] == 'h1':
            entradas.append((1, bloque[1]))
        elif bloque[0] == 'h2':
            entradas.append((2, bloque[1]))
    return entradas


def render(doc, paginas):
    figuras = 0
    tablas = 0
    primer_titulo = True

    for bloque in C.BLOQUES:
        tipo = bloque[0]

        if tipo == 'h1':
            F.h1(doc, bloque[1], page_break=primer_titulo or bloque[1].startswith('Anexo'))
            primer_titulo = False
        elif tipo == 'h2':
            F.h2(doc, bloque[1])
        elif tipo == 'h3':
            F.h3(doc, bloque[1])
        elif tipo == 'p':
            F.parrafo(doc, bloque[1], align='justify')
        elif tipo == 'lista':
            F.lista(doc, bloque[1])
        elif tipo == 'numeros':
            F.lista(doc, bloque[1], numbered=True)
        elif tipo == 'checklist':
            F.checklist(doc, bloque[1])
        elif tipo == 'tabla':
            datos = bloque[1]
            tablas += 1
            caption = None
            if datos.get('caption'):
                caption = f'Tabla {tablas}. {datos["caption"]}'
            F.tabla(
                doc,
                datos['headers'],
                datos['rows'],
                datos['widths'],
                caption=caption,
                font_size=datos.get('font', 9.0),
                align=datos.get('align'),
            )
        elif tipo == 'imagen':
            nombre, ancho, caption = bloque[1]
            figuras += 1
            F.imagen(doc, nombre, ancho, f'Figura {figuras}. {caption}')
        elif tipo == 'codigo':
            F.codigo(doc, bloque[1])
        elif tipo == 'callout':
            F.callout(doc, *bloque[1])
        elif tipo == 'parte':
            F.parte(doc, *bloque[1])
        else:
            raise ValueError(f'Bloque desconocido: {tipo}')


def construir(paginas):
    doc = F.nuevo_documento()
    F.configurar_header_footer(doc)
    F.portada(doc, C.META)
    F.indice(doc, entradas_indice(), paginas, page_break=True)
    render(doc, paginas)
    return doc


def texto_paginas(pdf_path):
    total = int(re.search(r'Pages:\s+(\d+)', subprocess.run(
        ['pdfinfo', str(pdf_path)], capture_output=True, text=True, check=True
    ).stdout).group(1))
    paginas = []
    for numero in range(1, total + 1):
        salida = subprocess.run(
            ['pdftotext', '-f', str(numero), '-l', str(numero), str(pdf_path), '-'],
            capture_output=True, text=True, check=True,
        ).stdout
        paginas.append(salida)
    return paginas


def calcular_paginas(paginas_texto, entradas):
    normalizadas = [normalizar(t) for t in paginas_texto]
    inicio = None
    for indice, texto in enumerate(normalizadas):
        if normalizar(FRASE_INICIO) in texto:
            inicio = indice
            break
    if inicio is None:
        raise RuntimeError('No se encontró el inicio del contenido en el PDF')

    resultado = {}
    actual = inicio
    for _, titulo in entradas:
        objetivo = normalizar(titulo)
        encontrado = None
        for indice in range(actual, len(normalizadas)):
            if objetivo and objetivo in normalizadas[indice]:
                encontrado = indice
                break
        if encontrado is not None:
            resultado[titulo] = encontrado + 1
            actual = encontrado
    faltantes = [titulo for _, titulo in entradas if titulo not in resultado]
    if faltantes:
        print('  Aviso: no se pudo ubicar en el PDF:', faltantes[:5])
    return resultado


def actualizar_propiedades(docx_path, pdf_path):
    """Escribe páginas y palabras reales en docProps/app.xml."""
    paginas = re.search(r'Pages:\s+(\d+)', subprocess.run(
        ['pdfinfo', str(pdf_path)], capture_output=True, text=True, check=True
    ).stdout).group(1)
    texto = subprocess.run(
        ['pdftotext', str(pdf_path), '-'], capture_output=True, text=True, check=True
    ).stdout
    palabras = len(texto.split())
    caracteres = len(texto.replace('\n', ''))

    with zipfile.ZipFile(docx_path) as original:
        entradas = [(info, original.read(info.filename)) for info in original.infolist()]

    with zipfile.ZipFile(docx_path, 'w', zipfile.ZIP_DEFLATED) as nuevo:
        for info, datos in entradas:
            if info.filename == 'docProps/app.xml':
                xml = datos.decode('utf-8')
                reemplazos = {
                    'Pages': paginas,
                    'Words': palabras,
                    'Characters': caracteres,
                    'CharactersWithSpaces': caracteres,
                }
                for etiqueta, valor in reemplazos.items():
                    xml = re.sub(rf'<{etiqueta}>\d+</{etiqueta}>', f'<{etiqueta}>{valor}</{etiqueta}>', xml)
                datos = xml.encode('utf-8')
            item = zipfile.ZipInfo(info.filename, date_time=info.date_time)
            item.compress_type = zipfile.ZIP_DEFLATED
            item.external_attr = info.external_attr
            nuevo.writestr(item, datos)


def main():
    entradas = entradas_indice()
    print(f'Informe: {len(entradas)} entradas de índice')

    tmp = Path(tempfile.mkdtemp(prefix='informe-reservorio-'))
    borrador = tmp / 'borrador.docx'
    pdf1 = tmp / 'borrador.pdf'

    print('Pasada 1: maquetación…')
    doc = construir({})
    doc.save(borrador)

    paginas = {}
    if X2T.exists() and subprocess.run(['which', 'pdftotext'], capture_output=True).returncode == 0:
        print('Calculando páginas reales…')
        convertir_pdf(borrador, pdf1)
        paginas = calcular_paginas(texto_paginas(pdf1), entradas)
        print(f'  {len(paginas)} de {len(entradas)} títulos ubicados')
    else:
        print('  x2t o pdftotext no disponibles: el índice quedará sin números reales')

    print('Pasada 2: índice definitivo…')
    doc = construir(paginas)
    doc.save(SALIDA)
    print(f'Documento guardado en {SALIDA}')

    if paginas:
        pdf2 = tmp / 'final.pdf'
        copia = tmp / 'final.docx'
        shutil.copy2(SALIDA, copia)
        convertir_pdf(copia, pdf2)
        verificacion = calcular_paginas(texto_paginas(pdf2), entradas)
        errores = {k: (paginas[k], verificacion[k]) for k in paginas if verificacion.get(k) != paginas[k]}
        if errores:
            print(f'  Aviso: {len(errores)} páginas cambiaron entre pasadas:', list(errores.items())[:3])
        else:
            print('  Índice verificado contra el PDF final')
        actualizar_propiedades(SALIDA, pdf2)
        print(f'  PDF de control: {pdf2}')

    print('Listo.')


if __name__ == '__main__':
    main()

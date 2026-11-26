"""Formato común de los documentos Word del proyecto (python-docx)."""

import io
from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor
from PIL import Image

AZUL = RGBColor(0x03, 0x69, 0xA1)
OSCURO = RGBColor(0x0F, 0x25, 0x37)
GRIS = RGBColor(0x4B, 0x61, 0x75)
FUENTE = 'Calibri'


def _fuente(estilo, tam, color=OSCURO, negrita=False):
    estilo.font.name = FUENTE
    estilo.font.size = Pt(tam)
    estilo.font.bold = negrita
    estilo.font.color.rgb = color
    rpr = estilo.element.get_or_add_rPr()
    fonts = rpr.find(qn('w:rFonts'))
    if fonts is None:
        fonts = OxmlElement('w:rFonts')
        rpr.append(fonts)
    for attr in ('w:ascii', 'w:hAnsi', 'w:eastAsia', 'w:cs'):
        fonts.set(qn(attr), FUENTE)


def nuevo_documento(pie):
    doc = Document()
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Cm(21), Cm(29.7)
    sec.left_margin = sec.right_margin = Cm(2.3)
    sec.top_margin, sec.bottom_margin = Cm(2.2), Cm(2.2)

    st = doc.styles
    _fuente(st['Normal'], 11)
    st['Normal'].paragraph_format.space_after = Pt(6)
    st['Normal'].paragraph_format.line_spacing = 1.15
    for nombre, tam, color, antes, despues in (
        ('Heading 1', 18, AZUL, 20, 8),
        ('Heading 2', 13.5, OSCURO, 14, 6),
        ('Heading 3', 12, AZUL, 10, 4),
    ):
        _fuente(st[nombre], tam, color, True)
        pf = st[nombre].paragraph_format
        pf.space_before, pf.space_after, pf.keep_with_next = Pt(antes), Pt(despues), True
    for nombre in ('List Bullet', 'List Number'):
        _fuente(st[nombre], 11)
        st[nombre].paragraph_format.space_after = Pt(3)

    # Pie de página: nombre del documento y número de página.
    par = sec.footer.paragraphs[0]
    par.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = par.add_run(f'{pie} · Página ')
    run.font.size, run.font.color.rgb = Pt(9), GRIS
    _campo(par, 'PAGE')
    return doc


def _campo(par, instruccion):
    def fld(tipo):
        r = par.add_run()
        el = OxmlElement('w:fldChar')
        el.set(qn('w:fldCharType'), tipo)
        r._r.append(el)
        r.font.size = Pt(9)
    fld('begin')
    r = par.add_run()
    it = OxmlElement('w:instrText')
    it.set(qn('xml:space'), 'preserve')
    it.text = instruccion
    r._r.append(it)
    fld('separate')
    r = par.add_run('1')
    r.font.size, r.font.color.rgb = Pt(9), GRIS
    fld('end')


def texto(doc_o_celda, contenido, tam=None, color=None, centrado=False, cursiva=False, estilo=None, despues=None):
    """Párrafo con **negritas** marcadas entre dobles asteriscos."""
    par = doc_o_celda.add_paragraph(style=estilo) if estilo else doc_o_celda.add_paragraph()
    for i, trozo in enumerate(contenido.split('**')):
        if not trozo:
            continue
        run = par.add_run(trozo)
        run.bold = i % 2 == 1
        run.italic = cursiva
        if tam:
            run.font.size = Pt(tam)
        if color:
            run.font.color.rgb = color
    if centrado:
        par.alignment = WD_ALIGN_PARAGRAPH.CENTER
    if despues is not None:
        par.paragraph_format.space_after = Pt(despues)
    return par


def vinetas(doc, items, numerada=False):
    # Las listas numeradas llevan el número escrito: así cada lista empieza en 1 (el estilo
    # 'List Number' de Word continúa la numeración de la lista anterior).
    for i, item in enumerate(items, 1):
        if numerada:
            par = texto(doc, f'**{i}.** {item}', despues=3)
            par.paragraph_format.left_indent = Cm(0.75)
            par.paragraph_format.first_line_indent = Cm(-0.5)
        else:
            texto(doc, item, estilo='List Bullet')


def titulo(doc, contenido, nivel=1):
    return doc.add_heading(contenido, level=nivel)


def salto(doc):
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)


def _sombrear(celda, color):
    tcpr = celda._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), color)
    tcpr.append(shd)


def _bordes(tabla, color='C7D3DD'):
    tblpr = tabla._tbl.tblPr
    bordes = OxmlElement('w:tblBorders')
    for lado in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        b = OxmlElement(f'w:{lado}')
        b.set(qn('w:val'), 'single')
        b.set(qn('w:sz'), '6')
        b.set(qn('w:space'), '0')
        b.set(qn('w:color'), color)
        bordes.append(b)
    tblpr.append(bordes)


def tabla(doc, encabezado, filas, anchos_cm, tam=10):
    t = doc.add_table(rows=1, cols=len(encabezado))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    _bordes(t)
    for i, (celda, txt) in enumerate(zip(t.rows[0].cells, encabezado)):
        celda.width = Cm(anchos_cm[i])
        _sombrear(celda, '0369A1')
        par = celda.paragraphs[0]
        run = par.add_run(txt)
        run.bold, run.font.size, run.font.color.rgb = True, Pt(tam), RGBColor(0xFF, 0xFF, 0xFF)
    for n, fila in enumerate(filas):
        celdas = t.add_row().cells
        for i, txt in enumerate(fila):
            celdas[i].width = Cm(anchos_cm[i])
            if n % 2 == 1:
                _sombrear(celdas[i], 'F1F6FA')
            par = celdas[i].paragraphs[0]
            for j, trozo in enumerate(str(txt).split('**')):
                if trozo:
                    run = par.add_run(trozo)
                    run.bold = j % 2 == 1
                    run.font.size = Pt(tam)
            par.paragraph_format.space_after = Pt(2)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t


def recuadro(doc, titulo_txt, contenido, tipo='info'):
    """Nota destacada: info (azul), aviso (ámbar) o ok (verde)."""
    fondos = {'info': ('E8F3FA', AZUL), 'aviso': ('FFF5DB', RGBColor(0x92, 0x40, 0x0E)), 'ok': ('E7F7EF', RGBColor(0x04, 0x78, 0x57))}
    fondo, color = fondos[tipo]
    t = doc.add_table(rows=1, cols=1)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    _bordes(t, fondo)
    celda = t.rows[0].cells[0]
    celda.width = Cm(16.4)
    _sombrear(celda, fondo)
    par = celda.paragraphs[0]
    run = par.add_run(titulo_txt)
    run.bold, run.font.color.rgb = True, color
    lineas = contenido if isinstance(contenido, list) else [contenido]
    for linea in lineas:
        texto(celda, linea, tam=10.5, despues=2)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


class Figuras:
    def __init__(self):
        self.n = 0

    def imagen(self, doc, ruta, ancho_cm, pie):
        self.n += 1
        im = Image.open(ruta).convert('RGB')
        buf = io.BytesIO()
        im.save(buf, 'JPEG', quality=88)
        buf.seek(0)
        doc.add_picture(buf, width=Cm(ancho_cm))
        doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
        doc.paragraphs[-1].paragraph_format.keep_with_next = True
        texto(doc, f'Figura {self.n}. {pie}', tam=9.5, color=GRIS, centrado=True, cursiva=True, despues=10)


def portada(doc, titulo_txt, subtitulo, detalle, imagen=None):
    for _ in range(3):
        doc.add_paragraph()
    texto(doc, 'MAQUETA DE RESERVORIO DE AGUA', tam=11, color=AZUL, despues=4)
    par = texto(doc, titulo_txt, tam=28, color=OSCURO, despues=6)
    par.runs[0].bold = True
    texto(doc, subtitulo, tam=14, color=GRIS, despues=18)
    if imagen:
        doc.add_picture(str(imagen), width=Cm(16.4))
        doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.add_paragraph()
    for linea in detalle:
        texto(doc, linea, tam=11, color=GRIS, despues=2)
    salto(doc)


def raiz():
    return Path(__file__).resolve().parents[2]

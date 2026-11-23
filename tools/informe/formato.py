"""Utilidades de formato para el informe DOCX del proyecto Reservorio."""

import re
from datetime import datetime
from pathlib import Path

from docx import Document
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT, WD_TAB_LEADER
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

ROOT = Path(__file__).resolve().parents[2]
IMG = ROOT / 'docs' / 'img'

INK = RGBColor(0x0F, 0x17, 0x2A)
NAVY = RGBColor(0x0B, 0x3C, 0x5D)
CYAN = RGBColor(0x08, 0x91, 0xB2)
GRAY = RGBColor(0x64, 0x74, 0x8B)
MUTED = RGBColor(0x94, 0xA3, 0xB8)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
BODY_FONT = 'Arial'
CODE_FONT = 'Consolas'

TEXT_WIDTH_CM = 17.0


# --------------------------------------------------------------------------
# XML helpers
# --------------------------------------------------------------------------
def _el(tag, **attrs):
    element = OxmlElement(tag)
    for key, value in attrs.items():
        element.set(qn(key), str(value))
    return element


def cell_bg(cell, hex_color):
    tcPr = cell._tc.get_or_add_tcPr()
    tcPr.append(_el('w:shd', **{'w:val': 'clear', 'w:color': 'auto', 'w:fill': hex_color.lstrip('#')}))


def cell_margins(table, top=50, bottom=50, left=90, right=90):
    tblPr = table._tbl.tblPr
    mar = _el('w:tblCellMar')
    for side, value in (('top', top), ('left', left), ('bottom', bottom), ('right', right)):
        mar.append(_el(f'w:{side}', **{'w:w': value, 'w:type': 'dxa'}))
    tblPr.append(mar)


def table_borders(table, color='DCE6EE', size=4, inside=True):
    tblPr = table._tbl.tblPr
    borders = _el('w:tblBorders')
    edges = ['top', 'left', 'bottom', 'right']
    if inside:
        edges += ['insideH', 'insideV']
    for edge in edges:
        borders.append(_el(f'w:{edge}', **{
            'w:val': 'single', 'w:sz': size, 'w:space': 0, 'w:color': color.lstrip('#'),
        }))
    tblPr.append(borders)


def table_no_borders(table):
    tblPr = table._tbl.tblPr
    borders = _el('w:tblBorders')
    for edge in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        borders.append(_el(f'w:{edge}', **{'w:val': 'nil'}))
    tblPr.append(borders)


def row_flags(row, header=False, keep=True):
    trPr = row._tr.get_or_add_trPr()
    if header:
        trPr.append(_el('w:tblHeader'))
    if keep:
        trPr.append(_el('w:cantSplit'))


def fixed_layout(table):
    table.autofit = False
    tblPr = table._tbl.tblPr
    layouts = tblPr.findall(qn('w:tblLayout'))
    for extra in layouts[1:]:
        tblPr.remove(extra)


def add_field(paragraph, instruction, placeholder='1'):
    run = paragraph.add_run()
    run._r.append(_el('w:fldChar', **{'w:fldCharType': 'begin'}))
    instr = _el('w:instrText', **{'xml:space': 'preserve'})
    instr.text = f' {instruction} '
    run._r.append(instr)
    run._r.append(_el('w:fldChar', **{'w:fldCharType': 'separate'}))
    text = OxmlElement('w:t')
    text.text = placeholder
    run._r.append(text)
    run._r.append(_el('w:fldChar', **{'w:fldCharType': 'end'}))


TBLPR_ORDER = [
    'tblStyle', 'tblpPr', 'tblOverlap', 'bidiVisual', 'tblStyleRowBandSize',
    'tblStyleColBandSize', 'tblW', 'jc', 'tblCellSpacing', 'tblInd', 'tblBorders',
    'shd', 'tblLayout', 'tblCellMar', 'tblLook', 'tblCaption', 'tblDescription',
    'tblPrChange',
]
TRPR_ORDER = [
    'cnfStyle', 'divId', 'gridBefore', 'gridAfter', 'wBefore', 'wAfter',
    'cantSplit', 'trHeight', 'tblHeader', 'tblCellSpacing', 'jc', 'hidden',
    'ins', 'del', 'trPrChange',
]
TCPR_ORDER = [
    'cnfStyle', 'tcW', 'gridSpan', 'hMerge', 'vMerge', 'tcBorders', 'shd',
    'noWrap', 'tcMar', 'textDirection', 'tcFitText', 'vAlign', 'hideMark',
    'headers', 'cellIns', 'cellDel', 'cellMerge', 'tcPrChange',
]


def _reordenar(parent, orden):
    if parent is None:
        return
    hijos = list(parent)

    def clave(elemento):
        etiqueta = elemento.tag.split('}')[-1]
        return orden.index(etiqueta) if etiqueta in orden else len(orden)

    hijos.sort(key=clave)
    for hijo in hijos:
        parent.remove(hijo)
    for hijo in hijos:
        parent.append(hijo)


def normalizar_tabla(table):
    """Deja los elementos XML en el orden que exige el esquema OOXML."""
    _reordenar(table._tbl.tblPr, TBLPR_ORDER)
    for row in table.rows:
        _reordenar(row._tr.trPr, TRPR_ORDER)
        for cell in row.cells:
            _reordenar(cell._tc.tcPr, TCPR_ORDER)


def paragraph_border(paragraph, edge='bottom', color='0891B2', size=8, space=4):
    pPr = paragraph._p.get_or_add_pPr()
    pBdr = _el('w:pBdr')
    pBdr.append(_el(f'w:{edge}', **{
        'w:val': 'single', 'w:sz': size, 'w:space': space, 'w:color': color.lstrip('#'),
    }))
    pPr.insert_element_before(
        pBdr,
        'w:shd', 'w:tabs', 'w:suppressAutoHyphens', 'w:kinsoku', 'w:wordWrap',
        'w:overflowPunct', 'w:topLinePunct', 'w:autoSpaceDE', 'w:autoSpaceDN',
        'w:bidi', 'w:adjustRightInd', 'w:snapToGrid', 'w:spacing', 'w:ind',
        'w:contextualSpacing', 'w:mirrorIndents', 'w:suppressOverlap', 'w:jc',
        'w:textDirection', 'w:textAlignment', 'w:textboxTightWrap',
        'w:outlineLvl', 'w:divId', 'w:cnfStyle', 'w:rPr', 'w:sectPr', 'w:pPrChange',
    )


def limpiar_final(doc):
    """Elimina párrafos vacíos al final del cuerpo (evitan páginas en blanco)."""
    body = doc.element.body
    for child in reversed(list(body)):
        if child.tag == qn('w:sectPr'):
            continue
        if child.tag != qn('w:p'):
            break
        text = ''.join(t.text or '' for t in child.iter(qn('w:t')))
        if text.strip():
            break
        body.remove(child)


# --------------------------------------------------------------------------
# Texto enriquecido: **negrita** y `código`
# --------------------------------------------------------------------------
TOKEN = re.compile(r'(\*\*.+?\*\*|`.+?`)')


def add_rich(paragraph, text, size=None, color=None, bold=False, italic=False, font=BODY_FONT):
    for chunk in TOKEN.split(text):
        if not chunk:
            continue
        is_bold = bold
        is_code = False
        if chunk.startswith('**') and chunk.endswith('**') and len(chunk) > 4:
            chunk = chunk[2:-2]
            is_bold = True
        elif chunk.startswith('`') and chunk.endswith('`') and len(chunk) > 2:
            chunk = chunk[1:-1]
            is_code = True

        run = paragraph.add_run(chunk)
        run.font.name = CODE_FONT if is_code else font
        run.bold = is_bold
        run.italic = italic
        if size:
            run.font.size = Pt(size - 0.6 if is_code else size)
        if color is not None:
            run.font.color.rgb = color


def spacing(paragraph, before=0, after=0, line=1.0, keep_next=False, keep_together=False):
    fmt = paragraph.paragraph_format
    fmt.space_before = Pt(before)
    fmt.space_after = Pt(after)
    fmt.line_spacing = line
    if keep_next:
        fmt.keep_with_next = True
    if keep_together:
        fmt.keep_together = True


# --------------------------------------------------------------------------
# Documento y estilos
# --------------------------------------------------------------------------
def nuevo_documento():
    doc = Document()

    section = doc.sections[0]
    section.page_width = Cm(21.0)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(2.2)
    section.bottom_margin = Cm(2.0)
    section.left_margin = Cm(2.0)
    section.right_margin = Cm(2.0)
    section.header_distance = Cm(1.0)
    section.footer_distance = Cm(1.0)

    normal = doc.styles['Normal']
    normal.font.name = BODY_FONT
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = INK
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.15
    rpr = normal.element.get_or_add_rPr()
    lang = _el('w:lang', **{'w:val': 'es-ES', 'w:eastAsia': 'es-ES'})
    rpr.append(lang)

    specs = {
        'Heading 1': (17, NAVY, 16, 8),
        'Heading 2': (12.5, CYAN, 12, 4),
        'Heading 3': (11, NAVY, 10, 3),
    }
    for name, (size, color, before, after) in specs.items():
        style = doc.styles[name]
        style.font.name = BODY_FONT
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.italic = False
        style.font.color.rgb = color
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(after)
        style.paragraph_format.keep_with_next = True
        style.paragraph_format.line_spacing = 1.0

    settings = doc.settings.element
    zoom = settings.find(qn('w:zoom'))
    if zoom is not None:
        zoom.attrib.clear()
        zoom.set(qn('w:percent'), '100')

    props = doc.core_properties
    props.title = 'Sistema de monitoreo de reservorio de agua'
    props.subject = 'Guía de conexión, configuración, calibración y pruebas con ESP32'
    props.author = 'Proyecto Reservorio de Agua'
    props.keywords = 'ESP32, sensores, agua, reservorio, pH, turbidez, HC-SR04, YF-S201'
    props.comments = 'Informe técnico de la fase 1. Generado desde el repositorio del proyecto.'
    props.created = datetime.now()
    props.modified = datetime.now()
    props.last_modified_by = 'Proyecto Reservorio de Agua'
    props.revision = 1

    if not section.different_first_page_header_footer:
        section.different_first_page_header_footer = True

    return doc


def configurar_header_footer(doc):
    section = doc.sections[0]
    header = section.header
    paragraph = header.paragraphs[0]
    paragraph.text = ''
    paragraph.paragraph_format.tab_stops.add_tab_stop(Cm(TEXT_WIDTH_CM), WD_TAB_ALIGNMENT.RIGHT)
    left = paragraph.add_run('Reservorio de Agua  ·  Informe técnico')
    left.font.name = BODY_FONT
    left.font.size = Pt(8)
    left.font.color.rgb = GRAY
    paragraph.add_run('\t\t')
    right = paragraph.add_run('Fase 1  ·  v1.0')
    right.font.name = BODY_FONT
    right.font.size = Pt(8)
    right.font.color.rgb = GRAY
    paragraph_border(paragraph, 'bottom', 'DCE6EE', 4, 2)

    footer = section.footer
    fp = footer.paragraphs[0]
    fp.text = ''
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r1 = fp.add_run('Página ')
    r1.font.size = Pt(8)
    r1.font.color.rgb = GRAY
    r1.font.name = BODY_FONT
    add_field(fp, 'PAGE')
    r2 = fp.add_run(' de ')
    r2.font.size = Pt(8)
    r2.font.color.rgb = GRAY
    r2.font.name = BODY_FONT
    add_field(fp, 'NUMPAGES')
    for run in fp.runs:
        run.font.size = Pt(8)
        run.font.color.rgb = GRAY
        run.font.name = BODY_FONT


# --------------------------------------------------------------------------
# Bloques
# --------------------------------------------------------------------------
def h1(doc, text, page_break=False):
    if page_break:
        limpiar_final(doc)
    paragraph = doc.add_paragraph(style='Heading 1')
    if page_break:
        paragraph.paragraph_format.page_break_before = True
    add_rich(paragraph, text)
    paragraph_border(paragraph, 'bottom', '0891B2', 6, 4)
    return paragraph


def h2(doc, text):
    paragraph = doc.add_paragraph(style='Heading 2')
    add_rich(paragraph, text)
    return paragraph


def h3(doc, text):
    paragraph = doc.add_paragraph(style='Heading 3')
    add_rich(paragraph, text)
    return paragraph


def parrafo(doc, text, size=10.5, color=None, before=0, after=6, align=None, italic=False):
    paragraph = doc.add_paragraph()
    add_rich(paragraph, text, size=size, color=color, italic=italic)
    spacing(paragraph, before, after, 1.15)
    if align == 'center':
        paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    elif align == 'justify':
        paragraph.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    return paragraph


def lista(doc, items, numbered=False, size=10.2):
    for index, item in enumerate(items, start=1):
        paragraph = doc.add_paragraph()
        fmt = paragraph.paragraph_format
        fmt.left_indent = Cm(0.62)
        fmt.first_line_indent = Cm(-0.42)
        fmt.space_before = Pt(0)
        fmt.space_after = Pt(2.5)
        fmt.line_spacing = 1.12
        marker = f'{index}.' if numbered else '•'
        run = paragraph.add_run(f'{marker}\t')
        run.bold = numbered
        run.font.name = BODY_FONT
        run.font.size = Pt(size)
        run.font.color.rgb = CYAN
        paragraph.paragraph_format.tab_stops.add_tab_stop(Cm(0.62))
        add_rich(paragraph, item, size=size)


def checklist(doc, items, size=10.2):
    for item in items:
        paragraph = doc.add_paragraph()
        fmt = paragraph.paragraph_format
        fmt.left_indent = Cm(0.62)
        fmt.first_line_indent = Cm(-0.42)
        fmt.space_before = Pt(0)
        fmt.space_after = Pt(2.5)
        fmt.line_spacing = 1.12
        box = paragraph.add_run('□\t')
        box.font.name = BODY_FONT
        box.font.size = Pt(size + 0.5)
        box.font.color.rgb = CYAN
        paragraph.paragraph_format.tab_stops.add_tab_stop(Cm(0.62))
        add_rich(paragraph, item, size=size)


def codigo(doc, text):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_ALIGN_PARAGRAPH.CENTER
    fixed_layout(table)
    row_flags(table.rows[0], keep=True)
    table.autofit = False
    table.columns[0].width = Cm(TEXT_WIDTH_CM)
    cell = table.cell(0, 0)
    cell.width = Cm(TEXT_WIDTH_CM)
    cell_bg(cell, 'F6F8FA')
    cell_margins(table, 90, 90, 140, 90)
    table_borders(table, 'E2E8F0', 4)

    first = True
    for line in text.rstrip('\n').split('\n'):
        paragraph = cell.paragraphs[0] if first else cell.add_paragraph()
        first = False
        fmt = paragraph.paragraph_format
        fmt.space_before = Pt(0)
        fmt.space_after = Pt(0)
        fmt.line_spacing = 1.0
        run = paragraph.add_run(line if line else ' ')
        run.font.name = CODE_FONT
        run.font.size = Pt(8.2)
        run.font.color.rgb = RGBColor(0x1F, 0x29, 0x37)
    normalizar_tabla(table)

    # separación después del bloque
    after = doc.add_paragraph()
    spacing(after, 0, 4, 1.0)


def callout(doc, kind, text):
    palette = {
        'nota': ('EFF6FF', '3B82F6', 'NOTA'),
        'importante': ('FFF7ED', 'F59E0B', 'IMPORTANTE'),
        'seguridad': ('FEF2F2', 'DC2626', 'SEGURIDAD'),
        'tip': ('ECFDF5', '10B981', 'CONSEJO'),
    }
    fill, border, label = palette.get(kind, palette['nota'])

    table = doc.add_table(rows=1, cols=1)
    fixed_layout(table)
    row_flags(table.rows[0], keep=True)
    table.columns[0].width = Cm(TEXT_WIDTH_CM)
    cell = table.cell(0, 0)
    cell.width = Cm(TEXT_WIDTH_CM)
    cell_bg(cell, fill)
    cell_margins(table, 90, 90, 140, 110)
    table_borders(table, border, 6)

    p = cell.paragraphs[0]
    spacing(p, 0, 2, 1.0)
    run = p.add_run(label)
    run.bold = True
    run.font.name = BODY_FONT
    run.font.size = Pt(8)
    run.font.color.rgb = RGBColor.from_string(border)

    p2 = cell.add_paragraph()
    spacing(p2, 0, 0, 1.12)
    add_rich(p2, text, size=9.8)

    normalizar_tabla(table)

    after = doc.add_paragraph()
    spacing(after, 0, 4, 1.0)


def tabla(doc, headers, rows, widths, caption=None, font_size=9.0, align=None):
    if caption:
        cap = doc.add_paragraph()
        spacing(cap, 8, 3, 1.0, keep_next=True)
        add_rich(cap, caption, size=8.6, color=CYAN, bold=True)

    table = doc.add_table(rows=1, cols=len(headers))
    fixed_layout(table)
    table_borders(table, 'DCE6EE', 4)
    cell_margins(table, 45, 45, 90, 90)

    total = sum(widths)
    scale = TEXT_WIDTH_CM / total if total > TEXT_WIDTH_CM else 1.0
    widths = [w * scale for w in widths]

    header_cells = table.rows[0].cells
    row_flags(table.rows[0], header=True)
    for index, header in enumerate(headers):
        cell = header_cells[index]
        cell.width = Cm(widths[index])
        cell_bg(cell, '0B3C5D')
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        p = cell.paragraphs[0]
        spacing(p, 0, 0, 1.0)
        add_rich(p, header, size=font_size, color=WHITE, bold=True)

    for r_index, row_data in enumerate(rows):
        row = table.add_row()
        row_flags(row, keep=True)
        for c_index, value in enumerate(row_data):
            cell = row.cells[c_index]
            cell.width = Cm(widths[c_index])
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            if r_index % 2 == 1:
                cell_bg(cell, 'F5F9FC')
            lines = str(value).split('\n')
            for l_index, line in enumerate(lines):
                p = cell.paragraphs[0] if l_index == 0 else cell.add_paragraph()
                spacing(p, 0, 0, 1.05)
                if align and c_index < len(align) and align[c_index] == 'center':
                    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                add_rich(p, line, size=font_size)

    for index, width in enumerate(widths):
        table.columns[index].width = Cm(width)

    normalizar_tabla(table)

    # Las tablas cortas se mantienen enteras en una página.
    if len(rows) <= 12:
        for row in table.rows[:-1]:
            for cell in row.cells:
                for paragraph in cell.paragraphs:
                    paragraph.paragraph_format.keep_with_next = True

    after = doc.add_paragraph()
    spacing(after, 0, 3, 1.0)


def imagen(doc, filename, width_cm, caption):
    path = IMG / filename
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    spacing(p, 4, 3, 1.0, keep_next=True)
    run = p.add_run()
    run.add_picture(str(path), width=Cm(width_cm))

    cap = doc.add_paragraph()
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    spacing(cap, 0, 10, 1.0)
    add_rich(cap, caption, size=8.6, color=GRAY, italic=True)


def parte(doc, numeral, title, description):
    limpiar_final(doc)
    p = doc.add_paragraph()
    p.paragraph_format.page_break_before = True
    spacing(p, 40, 4, 1.0)
    run = p.add_run(f'PARTE {numeral}')
    run.bold = True
    run.font.name = BODY_FONT
    run.font.size = Pt(11)
    run.font.color.rgb = CYAN

    t = doc.add_paragraph()
    spacing(t, 0, 10, 1.0)
    run = t.add_run(title)
    run.bold = True
    run.font.name = BODY_FONT
    run.font.size = Pt(27)
    run.font.color.rgb = NAVY

    paragraph_border(t, 'bottom', '0891B2', 8, 8)

    d = doc.add_paragraph()
    spacing(d, 10, 0, 1.2)
    add_rich(d, description, size=11.5, color=GRAY)


# --------------------------------------------------------------------------
# Portada e índice
# --------------------------------------------------------------------------
def portada(doc, meta):
    banner = doc.add_paragraph()
    banner.alignment = WD_ALIGN_PARAGRAPH.CENTER
    spacing(banner, 0, 0, 1.0)
    banner.add_run().add_picture(str(IMG / 'portada-banner.png'), width=Cm(17.0))

    p = doc.add_paragraph()
    spacing(p, 26, 4, 1.0)
    run = p.add_run('INFORME TÉCNICO')
    run.bold = True
    run.font.name = BODY_FONT
    run.font.size = Pt(9.5)
    run.font.color.rgb = CYAN
    # espaciado entre letras
    rPr = run._r.get_or_add_rPr()
    rPr.append(_el('w:spacing', **{'w:val': 60}))

    title = doc.add_paragraph()
    spacing(title, 0, 8, 1.0)
    run = title.add_run(meta['titulo'])
    run.bold = True
    run.font.name = BODY_FONT
    run.font.size = Pt(28)
    run.font.color.rgb = NAVY

    subtitle = doc.add_paragraph()
    spacing(subtitle, 0, 18, 1.15)
    add_rich(subtitle, meta['subtitulo'], size=13, color=GRAY)

    rule = doc.add_paragraph()
    spacing(rule, 0, 14, 1.0)
    paragraph_border(rule, 'bottom', 'DCE6EE', 8, 1)

    table = doc.add_table(rows=0, cols=2)
    fixed_layout(table)
    table_no_borders(table)
    cell_margins(table, 40, 40, 0, 100)
    for label, value in meta['datos']:
        row = table.add_row()
        c0, c1 = row.cells
        c0.width = Cm(4.0)
        c1.width = Cm(13.0)
        p0 = c0.paragraphs[0]
        spacing(p0, 2, 2, 1.0)
        r0 = p0.add_run(label.upper())
        r0.bold = True
        r0.font.name = BODY_FONT
        r0.font.size = Pt(7.6)
        r0.font.color.rgb = MUTED

        p1 = c1.paragraphs[0]
        spacing(p1, 2, 2, 1.0)
        add_rich(p1, value, size=9.6, color=INK)
    table.columns[0].width = Cm(4.0)
    table.columns[1].width = Cm(13.0)
    normalizar_tabla(table)

    spacer = doc.add_paragraph()
    spacing(spacer, 16, 0, 1.0)

    note = doc.add_paragraph()
    spacing(note, 0, 0, 1.2)
    add_rich(note, meta['pie'], size=8.4, color=MUTED, italic=True)

    shot = doc.add_paragraph()
    shot.alignment = WD_ALIGN_PARAGRAPH.CENTER
    spacing(shot, 26, 0, 1.0)
    shot.add_run().add_picture(str(IMG / 'portada-dashboard.png'), width=Cm(17.0))


def indice(doc, entries, pages, page_break=True):
    title = doc.add_paragraph()
    if page_break:
        title.paragraph_format.page_break_before = True
    spacing(title, 0, 14, 1.0)
    run = title.add_run('Índice de contenidos')
    run.bold = True
    run.font.name = BODY_FONT
    run.font.size = Pt(20)
    run.font.color.rgb = NAVY
    paragraph_border(title, 'bottom', '0891B2', 6, 4)

    for level, text in entries:
        paragraph = doc.add_paragraph()
        fmt = paragraph.paragraph_format
        fmt.tab_stops.add_tab_stop(Cm(16.85), WD_TAB_ALIGNMENT.RIGHT, WD_TAB_LEADER.DOTS)
        fmt.space_before = Pt(0 if level == 2 else 3)
        fmt.space_after = Pt(2.8 if level == 2 else 4.5)
        fmt.line_spacing = 1.0
        fmt.left_indent = Cm(0.55 if level == 2 else 0)
        size = 9.6 if level == 2 else 10.2
        run = paragraph.add_run(text)
        run.font.name = BODY_FONT
        run.font.size = Pt(size)
        run.bold = level == 1
        run.font.color.rgb = NAVY if level == 1 else GRAY

        page = str(pages.get(text, '00'))
        tab_run = paragraph.add_run('\t' + page)
        tab_run.font.name = BODY_FONT
        tab_run.font.size = Pt(size)
        tab_run.font.color.rgb = GRAY

"""Diagramas del proyecto (SVG) para los documentos Word.

Genera docs/img/conexiones.svg con el cableado REAL de la maqueta (26/11/2026) y corrige
el pinout y el divisor. Los PNG se obtienen después con tools/informe/generar.py.
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
IMG = ROOT / 'docs' / 'img'

FONT = 'Arial, Helvetica, sans-serif'
COL = {
    'analog': '#7c3aed',
    'digital': '#059669',
    'i2c': '#0891b2',
    'power': '#dc2626',
    'gnd': '#2563eb',
    'res': '#b45309',
}


def text(x, y, s, size=13, color='#0f172a', weight='400', anchor='start'):
    return (f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{weight}" fill="{color}" '
            f'text-anchor="{anchor}" font-family="{FONT}">{s}</text>')


def module(x, y, w, h, color, title, subtitle, lines):
    out = [
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="#ffffff" stroke="{color}" stroke-width="2.5"/>',
        f'<rect x="{x}" y="{y + 10}" width="6" height="{h - 20}" rx="3" fill="{color}"/>',
        text(x + 22, y + 30, title, 17, '#0f172a', '700'),
        text(x + 22, y + 50, subtitle, 12.5, color, '600'),
    ]
    for i, line in enumerate(lines):
        out.append(text(x + 22, y + 76 + i * 20, line, 12.5, '#334155'))
    return out


def wire(x1, y, x2, color, pin, side, label=None, badge=None):
    """Cable horizontal desde el módulo hasta el pin del ESP32 (side: 'L' o 'R' del ESP32)."""
    out = [f'<line x1="{x1}" y1="{y}" x2="{x2}" y2="{y}" stroke="{color}" stroke-width="3"/>']
    px = x2 if side == 'L' else x1
    out.append(f'<circle cx="{px}" cy="{y}" r="6" fill="{color}"/>')
    tx = px + 14 if side == 'L' else px - 14
    out.append(text(tx, y + 5, pin, 14, '#ffffff', '700', 'start' if side == 'L' else 'end'))
    mid = (x1 + x2) / 2
    if label:
        out.append(text(mid, y - (18 if badge else 12), label, 11.5, '#475569', '600', 'middle'))
    if badge:
        bw = 9 + len(badge) * 6.6
        out.append(f'<rect x="{mid - bw / 2}" y="{y - 11}" width="{bw}" height="22" rx="6" fill="#fff7ed" stroke="{COL["res"]}" stroke-width="1.5"/>')
        out.append(text(mid, y + 4.5, badge, 11, COL['res'], '700', 'middle'))
    return out


def conexiones():
    W, H = 1500, 1130
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
         f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
         f'<rect width="{W}" height="96" fill="#f1f5f9"/>',
         f'<rect x="0" y="92" width="{W}" height="4" fill="#0891b2"/>',
         text(40, 44, 'Conexión de los sensores al ESP32', 26, '#0f172a', '700'),
         text(40, 72, 'Cableado real de la maqueta · los pines se leen "D" en la placa (D18 = GPIO 18)', 14, '#64748b')]

    # ESP32
    ex, ey, ew, eh = 660, 130, 190, 800
    s += [f'<rect x="{ex}" y="{ey}" width="{ew}" height="{eh}" rx="20" fill="#0f2a3d" stroke="#0891b2" stroke-width="2"/>',
          text(ex + ew / 2, ey + 44, 'ESP32', 22, '#ffffff', '700', 'middle'),
          text(ex + ew / 2, ey + 66, 'DevKit V1 · 30 pines', 12, '#7dd3fc', '400', 'middle')]

    L1, L2 = 30, 450        # módulos del lado izquierdo
    R1, R2 = 1060, 1470     # módulos del lado derecho
    exL, exR = ex, ex + ew

    # ---- Lado izquierdo: pH, turbidez, caudal de salida, alimentación
    s += module(L1, 120, L2 - L1, 140, COL['analog'], 'pH · PH-7BNC', 'Analógico (Po)',
                ['V+ → 5 V (riel rojo) · G → GND (riel azul)', 'Po → 4.7 kΩ → D34 · D34 → 4.7 kΩ → GND',
                 '(divisor: baja la señal a la mitad)'])
    s += wire(L2, 210, exL, COL['analog'], 'D34', 'L', 'Po', 'divisor 4.7k + 4.7k')

    s += module(L1, 290, L2 - L1, 140, COL['analog'], 'Turbidez · TS-300B', 'Analógico (A)',
                ['V → 5 V · G → GND', 'A → 4.7 kΩ → D35 · D35 → 4.7 kΩ → GND',
                 '(divisor: baja la señal a la mitad)'])
    s += wire(L2, 380, exL, COL['analog'], 'D35', 'L', 'A', 'divisor 4.7k + 4.7k')

    s += module(L1, 460, L2 - L1, 140, COL['digital'], 'Caudal de SALIDA · ZJ-S201', 'Pulsos (efecto Hall)',
                ['Rojo → 5 V · Negro → GND', 'Amarillo → 4.7 kΩ → D26',
                 'Va en el tubo que sale hacia el pueblo'])
    s += wire(L2, 550, exL, COL['digital'], 'D26', 'L', 'amarillo', '4.7 kΩ en serie')

    s += module(L1, 700, L2 - L1, 170, COL['power'], 'Alimentación', 'USB 5 V (laptop, PC o cargador 5 V 2 A)',
                ['VIN → riel rojo (+5 V) de la protoboard', 'GND → riel azul (tierra común)',
                 'Todos los sensores toman 5 V y GND de los rieles', 'Sin pilas: se cuelga y puede dañar la memoria'])
    s += wire(L2, 790, exL, COL['power'], 'VIN', 'L', '+5 V')
    s += wire(L2, 830, exL, COL['gnd'], 'GND', 'L', 'tierra')

    # ---- Lado derecho: caudal de entrada, LCD, nivel, temperatura
    s += module(R1, 120, R2 - R1, 140, COL['digital'], 'Caudal de ENTRADA · ZJ-S201', 'Pulsos (efecto Hall)',
                ['Rojo → 5 V · Negro → GND', 'Amarillo → 4.7 kΩ → D23',
                 'Va en el tubo que llega del manantial'])
    s += wire(exR, 210, R1, COL['digital'], 'D23', 'R', 'amarillo', '4.7 kΩ en serie')

    s += module(R1, 290, R2 - R1, 140, COL['i2c'], 'Pantalla LCD 1602 I2C', 'Para el público (cada 4 s)',
                ['VCC → 5 V · GND → GND', 'SDA → D21 · SCL → D22', 'Dirección 0x27'])
    s += wire(exR, 360, R1, COL['i2c'], 'D21', 'R', 'SDA')
    s += wire(exR, 400, R1, COL['i2c'], 'D22', 'R', 'SCL')

    s += module(R1, 460, R2 - R1, 160, COL['digital'], 'Nivel · HC-SR04', 'Ultrasónico',
                ['VCC → 5 V · GND → GND', 'TRIG → D19 (directo)', 'ECHO → 4.7 kΩ → D18 (solo en serie,',
                 'sin resistencia a GND: con este sensor falla)'])
    s += wire(exR, 530, R1, COL['digital'], 'D19', 'R', 'TRIG')
    s += wire(exR, 575, R1, COL['digital'], 'D18', 'R', 'ECHO', '4.7 kΩ en serie')

    s += module(R1, 660, R2 - R1, 140, COL['digital'], 'Temperatura · DS18B20', 'Digital (1 cable de datos)',
                ['Rojo → 3.3 V · Negro → GND', 'Amarillo (DATA) → D4',
                 'Resistencia 4.7 kΩ entre DATA y 3.3 V'])
    s += wire(exR, 740, R1, COL['digital'], 'D4', 'R', 'DATA', 'pull-up 4.7k a 3.3 V')

    # Leyenda
    s += [f'<rect x="30" y="970" width="1440" height="130" rx="14" fill="#f8fafc" stroke="#cbd5e1"/>',
          text(54, 1000, 'REFERENCIAS', 12.5, '#475569', '700')]
    items = [('analog', 'Analógico'), ('digital', 'Digital / pulsos'), ('i2c', 'Pantalla (I2C)'),
             ('power', '5 V'), ('gnd', 'Tierra (GND)'), ('res', 'Resistencia')]
    for i, (k, name) in enumerate(items):
        x = 54 + i * 230
        s += [f'<circle cx="{x + 6}" cy="1028" r="7" fill="{COL[k]}"/>', text(x + 20, 1033, name, 13, '#334155')]
    s += [text(54, 1065, 'Nunca conectes 5 V directo a un pin D: las señales de 5 V pasan por una resistencia o por un divisor. '
               'Los pines D34 y D35 solo sirven como entrada.', 12.5, '#475569'),
          text(54, 1084, 'Revisa la serigrafía de tu placa: el orden físico de los pines puede variar entre clones.', 12.5, '#475569')]
    s.append('</svg>')
    (IMG / 'conexiones.svg').write_text('\n'.join(s), encoding='utf-8')


def caja(x, y, w, h, color, titulo, sub, lineas, dashed=False):
    dash = ' stroke-dasharray="8 6"' if dashed else ''
    out = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="16" fill="#ffffff" stroke="{color}" stroke-width="2.5"{dash}/>',
           f'<rect x="{x}" y="{y + 12}" width="6" height="{h - 24}" rx="3" fill="{color}"/>',
           text(x + 24, y + 34, titulo, 18, '#0f172a', '700'),
           text(x + 24, y + 56, sub, 13, color, '600')]
    for i, l in enumerate(lineas):
        out.append(text(x + 24, y + 84 + i * 21, l, 13, '#334155'))
    return out


def flecha(x1, y1, x2, y2, color='#64748b', label=None, dashed=False):
    dash = ' stroke-dasharray="7 6"' if dashed else ''
    out = [f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="3"{dash} marker-end="url(#m)"/>']
    if label:
        out.append(text((x1 + x2) / 2, (y1 + y2) / 2 - 10, label, 12, '#475569', '600', 'middle'))
    return out


def arquitectura():
    W, H = 1500, 900
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
         '<defs><marker id="m" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">'
         '<path d="M0 0 10 5 0 10z" fill="#64748b"/></marker></defs>',
         f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
         f'<rect width="{W}" height="96" fill="#f1f5f9"/>',
         f'<rect x="0" y="92" width="{W}" height="4" fill="#0891b2"/>',
         text(40, 44, 'Cómo viajan los datos', 26, '#0f172a', '700'),
         text(40, 72, 'De los sensores de la maqueta a la pantalla y a la página web', 14, '#64748b')]
    s += caja(30, 130, 380, 330, '#059669', 'Sensores (6)', 'Miden el agua del tanque',
              ['• Nivel de agua (ultrasónico)', '• Agua que entra (caudalímetro)', '• Agua que sale (caudalímetro)',
               '• Temperatura', '• pH (acidez)', '• Claridad (turbidez)', '', 'Alimentados con 5 V por USB'])
    s += caja(560, 170, 360, 250, '#0f2a3d', 'ESP32', 'El "cerebro" de la maqueta',
              ['Lee los sensores varias veces', 'por segundo, filtra el ruido y', 'calcula nivel, litros y caudal.',
               'Guarda las calibraciones y se', 'conecta al WiFi de la casa.'])
    s += flecha(410, 295, 556, 295, label='señales')
    s += caja(1060, 120, 410, 150, '#0891b2', 'Pantalla LCD', 'En la maqueta, para el público',
              ['Nivel, calidad del agua y caudal,', 'una página cada 4 segundos.'])
    s += flecha(920, 240, 1056, 200, label='cable')
    s += caja(1060, 300, 410, 170, '#0369a1', 'Página web de la maqueta', 'Red WiFi de la casa',
              ['http://192.168.2.200', 'Tablero con datos en vivo, modelo 3D,', 'caso real y mantenimiento (calibración).'])
    s += flecha(920, 330, 1056, 380, label='WiFi')
    s += caja(560, 560, 520, 290, '#7c3aed', 'Página publicada en internet', 'reservorio-agua-web.vercel.app',
              ['Sin conexión con la maqueta: muestra una', 'SIMULACIÓN de un día típico (bien marcada).',
               'En el mismo WiFi (Chrome/Edge): botón "Conectar', 'con la maqueta" y se ven los datos reales.',
               'Desde cualquier lugar: requiere activar la nube', '(Supabase), ya preparada en el proyecto.'])
    s += flecha(740, 420, 740, 556, label='', dashed=True)
    s += [text(752, 495, 'conexión directa o nube', 12, '#475569', '600')]
    s += caja(1160, 560, 310, 290, '#94a3b8', 'Nube (opcional)', 'Supabase',
              ['El ESP32 enviaría sus datos', 'cada 5 s con una clave secreta;', 'la página los leería desde',
               'cualquier lugar. Falta crear', 'el proyecto y activarla.'], dashed=True)
    s += flecha(1156, 700, 1084, 700, dashed=True)
    s.append('</svg>')
    (IMG / 'arquitectura.svg').write_text('\n'.join(s), encoding='utf-8')


def corregir_pinout_y_divisor():
    p = IMG / 'pinout-esp32.svg'
    s = p.read_text(encoding='utf-8')
    if 'Caudal salida' not in s:
        s = s.replace('<text x="614" y="786" font-size="10.5" fill="#64748b">YF-S201</text>',
                      '<text x="614" y="786" font-size="10.5" fill="#64748b">Caudal entrada</text>')
        s = s.replace('<rect x="254" y="483" width="26" height="22" rx="3" fill="#94a3b8" opacity="0.35"/>\n'
                      '  <text x="244" y="499" text-anchor="end" font-size="14" font-weight="600"\n'
                      '        fill="#475569">26</text>',
                      '<rect x="254" y="483" width="26" height="22" rx="3" fill="#059669" opacity="0.95"/>\n'
                      '  <text x="244" y="499" text-anchor="end" font-size="14" font-weight="600"\n'
                      '        fill="#059669">26</text>\n'
                      '  <text x="170" y="498" text-anchor="end" font-size="10.5" fill="#64748b">Caudal salida</text>')
        assert 'Caudal salida' in s and 'Caudal entrada' in s, 'pinout: no se encontró el texto a corregir'
        p.write_text(s, encoding='utf-8')

    p = IMG / 'divisor.svg'
    s = p.read_text(encoding='utf-8')
    old = 'HC-SR04 ECHO: 5 V → 2.5 V   ·   SEN0189 AO: 4.5 V → 2.25 V   ·   pH Po: 3.8 V → 1.9 V'
    if old in s:
        s = s.replace(old, 'Se usa en: turbidez TS-300B (A: hasta ~4.5 V → 2.25 V)   ·   pH PH-7BNC (Po: hasta ~3.8 V → 1.9 V)')
        p.write_text(s, encoding='utf-8')


if __name__ == '__main__':
    conexiones()
    arquitectura()
    corregir_pinout_y_divisor()
    print('diagramas listos')

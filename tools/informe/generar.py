"""Genera los documentos Word del proyecto (sin código, para leer e imprimir).

  - Informe-Reservorio-Agua.docx      reporte de lo que se hizo
  - docs/Conexion-de-sensores.docx    conexión de los sensores, cable por cable

Uso:  ./.venv/bin/python tools/informe/diagramas.py   (solo si cambian los diagramas)
      ./.venv/bin/python tools/informe/generar.py
Las capturas están en docs/img/captura-*.png.
"""

from estilo import (AZUL, GRIS, Figuras, nuevo_documento, portada, raiz, recuadro, salto, tabla,
                    texto, titulo, vinetas)

ROOT = raiz()
IMG = ROOT / 'docs' / 'img'
FECHA = '26 de noviembre de 2026'
WEB = 'https://reservorio-agua-web.vercel.app'
LOCAL = 'http://192.168.2.200'


# =============================================================================
#  REPORTE
# =============================================================================

def reporte():
    doc = nuevo_documento('Informe del proyecto · Reservorio de Agua')
    fig = Figuras()

    portada(doc, 'Informe del proyecto',
            'Monitoreo de un reservorio de agua con ESP32, gemelo digital y caso de uso real',
            [f'Fecha: {FECHA}', 'Elaborado por: ______________________________',
             f'Página publicada: {WEB}', 'Repositorio: github.com/LuchitoAE/reservorio-agua'],
            imagen=IMG / 'captura-tablero-en-vivo.png')

    titulo(doc, 'Contenido')
    for linea in ['1. Resumen', '2. Objetivo y alcance', '3. Componentes y sensores utilizados',
                  '4. Cómo funciona el sistema', '5. Calibración de los sensores', '6. Pantalla LCD',
                  '7. Página web y gemelo digital (maqueta 3D)', '8. Caso de uso real',
                  '9. Conexión en tiempo real: el enlace', '10. Alimentación del ESP32',
                  '11. Pruebas y resultados', '12. Pendientes y recomendaciones']:
        texto(doc, linea, despues=3)
    texto(doc, 'La conexión de cada sensor, cable por cable, está en el documento aparte '
               '**«Conexión de los sensores»** (docs/Conexion-de-sensores.docx).', color=GRIS)
    salto(doc)

    # 1 -----------------------------------------------------------------------
    titulo(doc, '1. Resumen')
    texto(doc, 'Se construyó una **maqueta de un reservorio de agua** —un tanque de vidrio de 40 × 30 cm de base y '
               '41 cm de alto, con su caseta de válvulas— que mide en tiempo real **seis variables**: el nivel del '
               'agua, el agua que entra, el agua que sale, la temperatura, el pH y la claridad del agua.')
    texto(doc, 'Los sensores están conectados a una placa **ESP32**, que lee los datos, los procesa y los muestra en '
               'una **pantalla LCD** en la propia maqueta y en una **página web**. La página presenta la maqueta en '
               '3D (gemelo digital) con seis tarjetas de datos y un **caso real** que explica dónde se usaría un '
               'reservorio así: un sistema de agua potable rural que lleva el agua de un manantial a un pueblo.')
    texto(doc, 'La página está publicada en internet. Cuando la maqueta no está conectada, muestra una '
               '**simulación** de un día típico, siempre marcada como tal, para que nunca se confundan datos '
               'simulados con reales.')
    fig.imagen(doc, IMG / 'arquitectura.png', 16.4, 'Cómo viajan los datos, de los sensores a la pantalla y a la web.')

    # 2 -----------------------------------------------------------------------
    titulo(doc, '2. Objetivo y alcance')
    texto(doc, '**Objetivo:** vigilar a distancia el estado de un reservorio de agua —cuánta agua tiene, cuánta '
               'entra y sale, y su calidad— y mostrarlo de forma clara para cualquier persona.')
    texto(doc, '**Alcance de esta etapa:**')
    vinetas(doc, [
        'Maqueta funcional con 6 sensores, pantalla LCD y conexión WiFi.',
        'Calibración de los sensores con referencias caseras (agua de caño, agua con tierra, limón).',
        'Página web con tablero en vivo, modelo 3D, caso real y página de mantenimiento.',
        'Publicación en internet (Vercel) con simulación y conexión directa desde el mismo WiFi.',
        'La nube para ver los datos reales desde cualquier lugar quedó preparada, pero sin activar (ver sección 12).',
    ])

    # 3 -----------------------------------------------------------------------
    titulo(doc, '3. Componentes y sensores utilizados')
    tabla(doc, ['Sensor', 'Qué mide', 'Modelo', 'Detalle'], [
        ['Nivel de agua', 'Distancia hasta el agua → altura, % y litros', 'HC-SR04 (ultrasónico)',
         'Va en la parte alta del tanque, mirando hacia abajo. Mide de 2 a 400 cm.'],
        ['Agua que entra', 'Litros por minuto y total', 'ZJ-S201 (efecto Hall, ½")',
         'En el tubo de llegada, fuera de la caseta. 1 a 30 L/min; 450 pulsos por litro.'],
        ['Agua que sale', 'Litros por minuto y total', 'ZJ-S201 (efecto Hall, ½")',
         'En el tubo de salida, fuera de la caseta.'],
        ['Temperatura', 'Temperatura del agua (°C)', 'DS18B20 sumergible',
         'Sonda de acero inoxidable; precisión ±0,5 °C.'],
        ['pH', 'Acidez o alcalinidad del agua', 'PH-7BNC con módulo',
         'Electrodo de vidrio con conector BNC y placa amplificadora.'],
        ['Claridad (turbidez)', 'Qué tan limpia está el agua (%)', 'TS-300B (óptico)',
         'Mide cuánta luz atraviesa el agua entre sus dos ventanas.'],
    ], [2.8, 3.8, 3.4, 6.4])
    texto(doc, '**Otros componentes:**')
    vinetas(doc, [
        '**ESP32 DevKit V1** (30 pines, WiFi 2,4 GHz, puerto USB-C): el “cerebro” de la maqueta.',
        '**Pantalla LCD 1602 con módulo I2C**: muestra los datos al público.',
        'Protoboard, cables Dupont y **8 resistencias de 4,7 kΩ** (para proteger las entradas del ESP32).',
        'Tanque de vidrio de 6 mm, caseta de válvulas, tubería de PVC de ½" y llaves de paso de PVC.',
    ])

    # 4 -----------------------------------------------------------------------
    titulo(doc, '4. Cómo funciona el sistema')
    texto(doc, 'Sin entrar en el código, esto es lo que se programó:')
    titulo(doc, '4.1 En el ESP32', 2)
    vinetas(doc, [
        '**Lectura de los sensores** varias veces por segundo (el nivel unas 14 veces por segundo).',
        '**Filtrado del ruido**: se descartan los picos y se promedian las lecturas, para que los valores no salten.',
        '**Cálculos**: altura del agua, porcentaje de llenado, litros, caudal en L/min y litros acumulados.',
        '**Memoria**: las calibraciones y los totales se guardan en la placa y no se pierden al apagarla.',
        '**WiFi**: se conecta a la red de la casa con una dirección fija (192.168.2.200) y publica su propia página web.',
        '**Pantalla LCD**: muestra la información en palabras simples, una página cada 4 segundos.',
        '**Actualización inalámbrica**: los cambios al programa se pueden cargar por WiFi, sin cable.',
        '**Nube (opcional)**: quedó programado el envío de datos a internet cada 5 segundos, protegido con una clave secreta.',
    ])
    titulo(doc, '4.2 En la página web', 2)
    vinetas(doc, [
        '**Tablero**: la maqueta en 3D con seis tarjetas de datos encima.',
        '**Caso real**: escena 3D de un sistema de agua de un pueblo, con un recorrido guiado en 6 pasos.',
        '**Simulación**: un día típico del reservorio cuando la maqueta no está conectada.',
        '**Mantenimiento**: calibración y valores técnicos, solo desde el WiFi de la maqueta.',
    ])

    # 5 -----------------------------------------------------------------------
    titulo(doc, '5. Calibración de los sensores')
    texto(doc, 'Calibrar es enseñarle al sistema qué valor corresponde a cada situación conocida. Las calibraciones '
               'se hicieron desde la página de **Mantenimiento** y quedan guardadas en el ESP32.')
    tabla(doc, ['Sensor', 'Cómo se calibró', 'Resultado'], [
        ['Nivel', 'Con el tanque **vacío** se midió la distancia del sensor al fondo (botón «Calibrar tanque vacío»).',
         'Fondo a **33,5 cm**. Vacío = 0 %. Lleno = **29 cm** (el tanque llena a 30; 1 cm de margen). '
         'Rebose a **31 cm**. Menos de 1 cm se toma como vacío.'],
        ['Claridad', 'Dos referencias: **agua de caño** (100 %) y **agua con tierra** recién batida (0 %).',
         'Agua de caño = 2,759 V · agua con tierra = 2,225 V. Verificado: la LCD marcó «AGUA CLARA 100 %».'],
        ['pH', 'Sin soluciones patrón: **agua de caño** (pH 7,55) y **jugo de limón** (pH 2,2) como referencias.',
         'Neutro (pH 7) = 2,60 V; 0,157 V por unidad de pH. Precisión aproximada ±0,3 pH.'],
        ['Temperatura', 'No necesita calibración (sensor digital calibrado de fábrica).',
         'Verificado con agua a temperatura ambiente: ~20,5 °C.'],
        ['Agua que entra / sale', 'Valor de fábrica del sensor: 450 pulsos por litro.',
         'Verificado que cuentan pulsos (soplando y con agua). Falta la prueba de 1 litro (sección 12).'],
    ], [2.6, 6.6, 7.2])
    recuadro(doc, 'Mejoras hechas durante la calibración', [
        'El sensor de claridad saltaba hasta 10 % por sí solo: ahora cada lectura promedia 16 medidas y la '
        'calibración guarda exactamente el valor que se muestra. Quedó 5 veces más estable.',
        'El sensor de nivel marcaba 9 % con el tanque vacío: se corrigió con la calibración de tanque vacío.',
    ], 'ok')
    fig.imagen(doc, IMG / 'captura-mantenimiento.png', 16.4,
               'Página de Mantenimiento: valores de los sensores, ajustes del tanque y botones de calibración.')

    # 6 -----------------------------------------------------------------------
    titulo(doc, '6. Pantalla LCD')
    texto(doc, 'La pantalla de la maqueta está pensada para el público: no muestra datos técnicos y usa palabras '
               'simples. Cambia de página **cada 4 segundos** y usa los mismos valores calibrados que la página web.')
    tabla(doc, ['Página', 'Línea 1', 'Línea 2'], [
        ['1 · Nivel', 'Nivel 75 %   25 L', 'NIVEL NORMAL / CASI LLENO / TANQUE LLENO / REBALSANDO…'],
        ['2 · Calidad', 'pH 7,5   Neutro', 'Temp.   20,5 °C'],
        ['3 · Claridad', 'Claridad   98 %', 'AGUA CLARA / POCO TURBIA / AGUA TURBIA'],
        ['4 · Caudal', 'Entra   3,2 L/min', 'Sale   0,0 L/min'],
    ], [3.0, 5.4, 8.0])
    texto(doc, 'Si un sensor no responde, su página se salta, para que el público nunca vea valores vacíos.', color=GRIS)

    # 7 -----------------------------------------------------------------------
    titulo(doc, '7. Página web y gemelo digital (maqueta 3D)')
    texto(doc, 'La página principal muestra la maqueta en 3D con **seis tarjetas**: nivel de agua, agua que entra, '
               'agua que sale, temperatura, pH y claridad. Cada tarjeta indica el valor, una frase simple (por '
               'ejemplo «Temperatura normal») y una pequeña gráfica de los últimos minutos. Arriba, un interruptor '
               'permite pasar de la **Maqueta 3D** al **Caso real**.')
    fig.imagen(doc, IMG / 'captura-tablero-en-vivo.png', 16.4,
               'Tablero con datos reales de la maqueta («En vivo»): tanque vacío, 20,3 °C y pH 7,38.')
    texto(doc, 'El modelo 3D reproduce el plano del reservorio: tanque de vidrio, caseta de válvulas, tubería de '
               'PVC gris y llaves de paso de PVC con manija roja (la del by-pass, cerrada). Para completar la '
               'maqueta se agregaron: un **balde elevado** que alimenta la entrada por gravedad mediante una '
               'manguera, un **balde de recolección** a la salida y un **sumidero** en el piso para la limpia y el '
               'rebose. El agua se ve avanzar por los tubos y las mangueras según los litros por minuto, el color '
               'del agua cambia con la claridad y, si el tanque rebalsa, se ilumina el tubo de rebose.')
    fig.imagen(doc, IMG / 'captura-maqueta-caseta.png', 16.4,
               'Vista «Ver caseta»: balde de entrada elevado, mangueras, balde de salida y sumidero (simulación).')
    fig.imagen(doc, IMG / 'captura-tablero-simulacion.png', 16.4,
               'Modo simulación: aviso amarillo «estos datos no son reales» y agua circulando.')
    texto(doc, '**Simulación:** si la maqueta no está conectada, la página muestra un día típico de un reservorio '
               'rural (un día dura 12 minutos): de noche se llena y rebalsa un rato al amanecer; en la mañana (7 h) y '
               'en la tarde (19 h) el pueblo consume más y el nivel baja hasta ~44 %; algunos días llueve y la '
               'claridad baja. Un aviso amarillo indica siempre que los datos no son reales.')
    fig.imagen(doc, IMG / 'captura-tablero-celular.png', 5.5, 'La misma página en un celular.')

    # 8 -----------------------------------------------------------------------
    titulo(doc, '8. Caso de uso real')
    texto(doc, 'La maqueta representa un **reservorio apoyado con caseta de válvulas**, el diseño típico de los '
               'sistemas de agua potable rurales **por gravedad**, como los que administran las JASS (Juntas '
               'Administradoras de Servicios de Saneamiento). El recorrido del agua es:')
    vinetas(doc, [
        '**Manantial y captación**: el agua brota del cerro y se protege en una caja de concreto.',
        '**Línea de conducción**: una tubería enterrada la baja por gravedad (aquí va el medidor de entrada).',
        '**Reservorio apoyado**: guarda el agua y se clora; está en una loma más alta que el pueblo.',
        '**Caseta de válvulas**: entrada, salida, by-pass, limpia y rebose (aquí va el medidor de salida).',
        '**Línea de aducción y red**: lleva el agua a las piletas de cada casa.',
    ], numerada=True)
    fig.imagen(doc, IMG / 'captura-caso-real-general.png', 16.4,
               'Caso real: del manantial (arriba) al reservorio en la loma y al pueblo (abajo).')
    texto(doc, '**Escala aproximada:** la maqueta llena (32 litros) representa un reservorio real de unos **10 m³**, '
               'que abastece a unas 300 a 400 personas; guarda aproximadamente un tercio del agua que el pueblo '
               'usa en un día.')
    tabla(doc, ['Sensor', 'Para qué serviría en un pueblo'], [
        ['Nivel', 'Saber si alcanza el agua para la tarde y avisar antes de que se acabe o rebalse.'],
        ['Agua que entra', 'Detectar si la captación se tapó o si se rompió la tubería de conducción.'],
        ['Agua que sale', 'Conocer el consumo del pueblo y descubrir fugas (consumo alto de madrugada).'],
        ['Claridad', 'En lluvias el agua se enturbia: avisa para no distribuir agua sucia.'],
        ['pH y temperatura', 'Controlar la calidad del agua y la eficacia de la cloración.'],
    ], [3.4, 13.0])
    fig.imagen(doc, IMG / 'captura-caso-real-reservorio.png', 16.4,
               'Recorrido guiado (paso 4 de 6): el reservorio en corte, con su nivel y el dato en vivo.')

    # 9 -----------------------------------------------------------------------
    titulo(doc, '9. Conexión en tiempo real: el enlace')
    texto(doc, 'Para ver datos reales, el ESP32 debe estar **encendido y conectado al WiFi de la casa** '
               '(red de 2,4 GHz). Siempre usa la dirección fija **192.168.2.200**.')
    tabla(doc, ['Dónde estás', 'Enlace', 'Qué ves'], [
        ['En el WiFi de la maqueta', LOCAL,
         'Datos **en vivo**, la maqueta 3D, el caso real y **Mantenimiento** (calibración).'],
        ['En el mismo WiFi, con el enlace público', WEB,
         'Pulsa «**Conectar con la maqueta (mismo WiFi)**» y en Chrome o Edge «**Permitir**»: datos en vivo '
         '(solo lectura). El navegador lo recuerda.'],
        ['En cualquier otro lugar', WEB,
         'La **simulación** (marcada). Para ver datos reales desde cualquier lugar falta activar la nube (sección 12).'],
    ], [3.6, 5.0, 7.8])
    recuadro(doc, '¿Por qué el enlace público no muestra solo los datos reales?', [
        'La dirección 192.168.2.200 existe solo dentro del WiFi de la casa: desde otro lugar no se puede llegar '
        'a ella. Para verla desde cualquier lugar, el ESP32 debe enviar sus datos a internet (la nube Supabase), '
        'y la página los lee de ahí. Esa parte ya está programada y solo falta crear el proyecto en la nube.',
    ], 'info')
    texto(doc, '**Publicación:** la página está en Vercel, que publica automáticamente cada cambio aprobado en el '
               'repositorio de GitHub. El informe y el programa del ESP32 se guardan en el repositorio, pero no se '
               'publican en la página.')

    # 10 ----------------------------------------------------------------------
    titulo(doc, '10. Alimentación del ESP32')
    texto(doc, 'El ESP32 y todos los sensores funcionan con **5 V** que entran por el **puerto USB-C** de la placa. '
               'Del pin VIN salen esos 5 V al riel rojo de la protoboard, de donde se alimentan los sensores. '
               'El consumo total es de unos **220 mA** (0,22 A).')
    tabla(doc, ['Fuente', '¿Sirve?', 'Comentario'], [
        ['Laptop o PC (cable USB)', '**Sí**', 'Ideal para pruebas y para cargar el programa. La computadora debe '
         'quedar encendida: si se suspende, la maqueta se apaga.'],
        ['Cargador de celular USB (5 V, 1 A o más; mejor 2 A)', '**Sí · recomendado**',
         'La mejor opción para dejar la maqueta funcionando todo el día, por ejemplo en una exposición.'],
        ['Batería portátil (power bank) USB 5 V', '**Sí**', 'Para usarla sin enchufe. Una de 10 000 mAh dura '
         'aproximadamente un día. Algunas se apagan solas si el consumo es bajo: elegir una que no lo haga.'],
        ['Pilas AA (4 en portapilas)', '**No**', 'Se probó: el voltaje baja, el ESP32 se reinicia o se cuelga y '
         'llegó a dañar la memoria de configuración (hubo que borrarla).'],
        ['Pila de 9 V', '**No**', 'Dura muy poco y calienta el regulador de la placa.'],
    ], [4.6, 2.6, 9.2])
    recuadro(doc, 'Reglas de alimentación', [
        'Usa un cable USB de buena calidad (de carga y datos).',
        'No conectes al mismo tiempo el USB y otra fuente de 5 V en el pin VIN.',
        'Todos los sensores comparten la misma tierra (GND, riel azul).',
    ], 'aviso')

    # 11 ----------------------------------------------------------------------
    titulo(doc, '11. Pruebas y resultados')
    tabla(doc, ['Prueba', 'Resultado'], [
        ['Los 6 sensores responden', '**Correcto**: 6 de 6 con lectura.'],
        ['Nivel con el tanque vacío', '**Correcto**: 0 cm, 0 %, «TANQUE VACÍO».'],
        ['Claridad en agua de caño', '**Correcto**: 100 %, «AGUA CLARA» en la LCD.'],
        ['pH en agua de caño', '**Correcto**: entre 7,3 y 7,6 (neutra).'],
        ['Temperatura ambiente', '**Correcto**: ~20,5 °C.'],
        ['Medidores de caudal', '**Correcto**: cuentan pulsos al pasar agua o al soplar.'],
        ['Pantalla LCD', '**Correcto**: 4 páginas, cada 4 segundos.'],
        ['Página en la red de la casa', '**Correcto**: datos en vivo cada fracción de segundo.'],
        ['Página publicada (Vercel)', '**Correcto**: simulación marcada y conexión directa desde el mismo WiFi.'],
        ['Calibraciones tras apagar y encender', '**Correcto**: se conservan.'],
        ['Actualización del programa por WiFi', '**Correcto**.'],
    ], [6.4, 10.0])

    # 12 ----------------------------------------------------------------------
    titulo(doc, '12. Pendientes y recomendaciones')
    vinetas(doc, [
        '**Activar la nube (Supabase)** para ver los datos reales desde cualquier lugar con el enlace público. '
        'El ESP32 y la página ya están preparados.',
        '**Verificar los medidores de caudal** pasando exactamente 1 litro: deben marcar ~1,0 L.',
        '**Calibrar el pH con soluciones patrón** (pH 4 y pH 7) para ganar precisión.',
        '**Montar los sensores en la maqueta definitiva** (el de nivel a 36 cm del fondo, mirando al agua) y '
        'proteger la electrónica de la humedad.',
        'Dejar la maqueta con un **cargador USB de 5 V y 2 A** para uso continuo.',
    ])
    texto(doc, 'Documento complementario: **«Conexión de los sensores»** (docs/Conexion-de-sensores.docx).', color=AZUL)

    salida = ROOT / 'Informe-Reservorio-Agua.docx'
    doc.save(salida)
    return salida


# =============================================================================
#  CONEXIÓN DE LOS SENSORES
# =============================================================================

def conexion():
    doc = nuevo_documento('Conexión de los sensores · Reservorio de Agua')
    fig = Figuras()

    portada(doc, 'Conexión de los sensores',
            'Cómo conectar cada sensor al ESP32, cable por cable',
            [f'Fecha: {FECHA}', 'Placa: ESP32 DevKit V1 (30 pines). En la placa los pines se leen con «D»: D18 = GPIO 18.'],
            imagen=IMG / 'conexiones.png')

    titulo(doc, '1. Antes de empezar')
    texto(doc, '**Materiales:**')
    vinetas(doc, [
        'ESP32 DevKit V1 y su cable USB-C.',
        'Protoboard con rieles de alimentación (rojo + y azul −).',
        'Sensores: HC-SR04, 2 × ZJ-S201, DS18B20, PH-7BNC con su módulo, TS-300B y la pantalla LCD 1602 I2C.',
        '**8 resistencias de 4,7 kΩ** (amarillo, violeta, rojo) y cables Dupont.',
        'Un multímetro (recomendado) para revisar resistencias y continuidad.',
    ])
    recuadro(doc, 'Reglas de seguridad', [
        '**Desconecta el USB** siempre antes de mover un cable.',
        'El pin **VIN** lleva 5 V al **riel rojo**; el pin **GND** va al **riel azul**. Todos los sensores toman de ahí su 5 V y su tierra.',
        '**Nunca** conectes una señal de 5 V directo a un pin D: pasa por una resistencia o por un divisor (abajo se indica cuál).',
        'Los pines **D34 y D35** solo sirven como entrada (por eso ahí van las señales analógicas).',
        'Revisa la serigrafía de tu placa: el orden físico de los pines puede variar entre clones.',
    ], 'aviso')

    titulo(doc, '2. Esquema general')
    fig.imagen(doc, IMG / 'conexiones.png', 16.4, 'Conexión de todos los sensores al ESP32 (cableado real de la maqueta).')
    fig.imagen(doc, IMG / 'pinout-esp32.png', 10.5, 'Pines del ESP32 DevKit V1 usados en el proyecto.')
    fig.imagen(doc, IMG / 'protoboard.png', 15.0, 'Protoboard: el ESP32 a caballo del canal central y los rieles de 5 V y GND.')

    titulo(doc, '3. Alimentación')
    tabla(doc, ['Desde', 'Hacia', 'Nota'], [
        ['USB-C de la placa', 'Laptop, PC o cargador USB 5 V (mejor 2 A)', 'No usar pilas AA ni pila de 9 V.'],
        ['Pin **VIN** del ESP32', 'Riel **rojo** (+5 V)', 'De aquí sale el 5 V de todos los sensores.'],
        ['Pin **GND** del ESP32', 'Riel **azul** (−)', 'Tierra común: todos los GND van aquí.'],
        ['Pin **3V3** del ESP32', 'Solo el sensor de temperatura y su resistencia', 'No llevar 3,3 V al riel rojo.'],
    ], [4.0, 6.0, 6.4])

    def sensor(nombre, descripcion, filas, prueba, notas=None):
        titulo(doc, nombre, 2)
        texto(doc, descripcion)
        tabla(doc, ['Cable o pin del sensor', 'Va a', 'Nota'], filas, [4.2, 5.4, 6.8])
        if notas:
            recuadro(doc, 'Importante', notas, 'aviso')
        texto(doc, f'**Prueba:** {prueba}')

    titulo(doc, '4. Conexión de cada sensor')
    sensor('4.1 Nivel de agua · HC-SR04 (ultrasónico)',
           'Va en la parte alta del tanque, mirando hacia el agua.',
           [['VCC', 'Riel rojo (5 V)', ''], ['GND', 'Riel azul (GND)', ''],
            ['TRIG', '**D19**', 'Directo, sin resistencia.'],
            ['ECHO', 'Resistencia de **4,7 kΩ** → **D18**', 'Solo la resistencia en serie.']],
           'pon un libro a 20 cm del sensor: debe marcar cerca de 20 cm de distancia.',
           ['Con este sensor **no** pongas resistencias del ECHO a GND (divisor): la señal queda débil y deja de '
            'medir. Basta una sola resistencia de 4,7 kΩ en serie, que protege al ESP32.'])
    sensor('4.2 Agua que entra · ZJ-S201',
           'Va en el tubo que llega al tanque, **fuera de la caseta**, con la flecha del cuerpo en el sentido del agua.',
           [['Rojo', 'Riel rojo (5 V)', ''], ['Negro', 'Riel azul (GND)', ''],
            ['Amarillo (señal)', 'Resistencia de **4,7 kΩ** → **D23**', 'El ESP32 activa su resistencia interna.']],
           'sopla suavemente por el sensor en el sentido de la flecha: el número de pulsos debe subir.',
           ['No agregues otra resistencia a 3,3 V: con la resistencia en serie, la señal no bajaría lo suficiente y no contaría.',
            'Por debajo de ~1 L/min la turbina no gira (es normal que marque 0).'])
    sensor('4.3 Agua que sale · ZJ-S201',
           'Igual que el de entrada, en el tubo que sale hacia el pueblo, fuera de la caseta.',
           [['Rojo', 'Riel rojo (5 V)', ''], ['Negro', 'Riel azul (GND)', ''],
            ['Amarillo (señal)', 'Resistencia de **4,7 kΩ** → **D26**', '']],
           'igual que el de entrada: al soplar suben los pulsos de «agua que sale».')
    sensor('4.4 Temperatura · DS18B20 (sumergible)',
           'Sonda de acero que va dentro del agua.',
           [['Rojo', 'Pin **3V3**', 'Este sensor va a 3,3 V, no a 5 V.'], ['Negro', 'Riel azul (GND)', ''],
            ['Amarillo (DATA)', '**D4**', ''],
            ['Resistencia 4,7 kΩ', 'Entre **D4** y **3V3**', 'Obligatoria: sin ella no responde.']],
           'a temperatura ambiente marca ~20 °C; si lo tomas con la mano, sube.',
           ['Si tu sonda tiene otros colores, revisa su hoja: normalmente rojo = +, negro = −, y el tercer cable es DATA.'])
    sensor('4.5 pH · PH-7BNC con su módulo',
           'El electrodo se enrosca al conector BNC del módulo. Del módulo se usan tres pines.',
           [['V+', 'Riel rojo (5 V)', ''], ['G', 'Riel azul (GND)', ''],
            ['Po (señal)', 'Resistencia **4,7 kΩ** → **D34**', 'Primera mitad del divisor.'],
            ['—', 'Desde **D34**, otra resistencia **4,7 kΩ** → GND', 'Segunda mitad del divisor.'],
            ['Do, To', 'Sin conectar', 'No se usan.']],
           'con el electrodo en agua de caño debe marcar alrededor de pH 7,5.',
           ['La señal Po puede llegar a ~3,8 V: el divisor la baja a la mitad para el ESP32.',
            'No muevas el tornillo (potenciómetro) del módulo después de calibrar.',
            'Guarda el electrodo húmedo, con su capuchón: si se seca, se daña.'])
    sensor('4.6 Claridad · TS-300B (turbidez)',
           'La parte transparente (sus dos «patitas») debe quedar sumergida y sin burbujas.',
           [['V', 'Riel rojo (5 V)', ''], ['G', 'Riel azul (GND)', ''],
            ['A (señal)', 'Resistencia **4,7 kΩ** → **D35**', 'Primera mitad del divisor.'],
            ['—', 'Desde **D35**, otra resistencia **4,7 kΩ** → GND', 'Segunda mitad del divisor.'],
            ['D', 'Sin conectar', 'No se usa.']],
           'en agua de caño debe marcar cerca de 100 % («AGUA CLARA»).',
           ['Si falta la resistencia de D35 a GND, la lectura se satura (marca siempre 100 % o valores raros). '
            'Revisa con el multímetro (USB desconectado): entre D35 y GND debe haber ~4,7 kΩ.',
            'La luz del sol o de una lámpara cambia la medida: mide siempre en el mismo lugar.'])
    sensor('4.7 Pantalla LCD 1602 I2C',
           'El módulo I2C va soldado detrás de la pantalla y tiene 4 pines.',
           [['GND', 'Riel azul (GND)', ''], ['VCC', 'Riel rojo (5 V)', ''],
            ['SDA', '**D21**', ''], ['SCL', '**D22**', '']],
           'al encender aparece «RESERVORIO DE AGUA» y luego los datos, una página cada 4 segundos.',
           ['Si se enciende la luz pero no se ven letras, gira el tornillo azul del módulo (contraste).',
            'Si no aparece nada, revisa que SDA y SCL no estén cruzados. Se puede conectar con todo encendido: '
            'el ESP32 la busca cada 5 segundos.'])

    titulo(doc, '5. El divisor de tensión (pH y claridad)')
    texto(doc, 'Algunos sensores entregan hasta 4,5 V, pero las entradas del ESP32 aceptan como máximo 3,3 V. '
               'Dos resistencias iguales de 4,7 kΩ forman un **divisor** que baja la señal **a la mitad**; el '
               'programa la vuelve a multiplicar por 2. Ya está considerado en la calibración.')
    fig.imagen(doc, IMG / 'divisor.png', 15.0, 'Divisor de tensión con dos resistencias de 4,7 kΩ.')

    titulo(doc, '6. Resumen de pines')
    tabla(doc, ['Pin', 'Conectado a', 'Con'], [
        ['D34', 'pH (Po)', 'Divisor 4,7 kΩ + 4,7 kΩ'],
        ['D35', 'Claridad (A)', 'Divisor 4,7 kΩ + 4,7 kΩ'],
        ['D19', 'Nivel (TRIG)', 'Directo'],
        ['D18', 'Nivel (ECHO)', '4,7 kΩ en serie'],
        ['D23', 'Agua que entra (amarillo)', '4,7 kΩ en serie'],
        ['D26', 'Agua que sale (amarillo)', '4,7 kΩ en serie'],
        ['D4', 'Temperatura (DATA)', '4,7 kΩ a 3V3'],
        ['D21 / D22', 'Pantalla LCD (SDA / SCL)', 'Directo'],
        ['VIN', 'Riel rojo (+5 V)', '—'],
        ['GND', 'Riel azul (tierra común)', '—'],
        ['3V3', 'Temperatura (rojo) y su resistencia', '—'],
    ], [3.0, 7.2, 6.2])

    titulo(doc, '7. Revisión final y problemas comunes')
    texto(doc, '**Antes de enchufar el USB, revisa:**')
    vinetas(doc, [
        'Ningún cable de 5 V llega directo a un pin D.',
        'Todas las tierras (GND) están en el riel azul.',
        'Las 8 resistencias de 4,7 kΩ están en su lugar (2 + 2 de los divisores, 3 en serie y 1 de la temperatura).',
        'Los rieles de la protoboard están unidos si vienen partidos a la mitad.',
    ])
    tabla(doc, ['Síntoma', 'Causa probable', 'Solución'], [
        ['El nivel no mide («sin lectura»)', 'Divisor en el ECHO o cable flojo', 'Deja solo la resistencia en serie de ECHO a D18.'],
        ['La claridad marca siempre 100 %', 'Falta la resistencia de D35 a GND', 'Coloca la segunda resistencia del divisor.'],
        ['La temperatura no responde', 'Falta la resistencia de D4 a 3V3', 'Coloca la resistencia de 4,7 kΩ.'],
        ['El caudal marca 0 con agua', 'Flecha al revés o caudal muy bajo', 'Gira el sensor; con menos de 1 L/min no mide.'],
        ['La pantalla no muestra letras', 'Contraste o SDA/SCL cruzados', 'Gira el tornillo azul; revisa D21 y D22.'],
        ['El ESP32 se reinicia o se cuelga', 'Alimentación débil (pilas)', 'Usa la laptop o un cargador USB de 5 V y 2 A.'],
    ], [4.6, 5.2, 6.6])

    salida = ROOT / 'docs' / 'Conexion-de-sensores.docx'
    doc.save(salida)
    return salida


if __name__ == '__main__':
    for ruta in (reporte(), conexion()):
        print('generado:', ruta.relative_to(ROOT))

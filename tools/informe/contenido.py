"""Contenido del informe técnico. Cada bloque se traduce a un elemento del DOCX."""

META = {
    "titulo": "Sistema de monitoreo de reservorio de agua",
    "subtitulo": "Guía de conexión, configuración, calibración y pruebas con ESP32",
    "datos": [
        ("Proyecto", "Reservorio de Agua · instalación de sensores y tablero de monitoreo"),
        ("Hardware", "ESP32 DevKit V1 (30 pines) · 5 sensores · pantalla LCD 1602 I2C"),
        ("Alcance", "Fase 1: montaje en protoboard, firmware y dashboard local"),
        ("Versión", "1.0 · noviembre de 2026"),
        ("Documento", "Informe técnico de instalación y puesta en marcha"),
    ],
    "pie": "Documento generado desde el repositorio del proyecto. Las mediciones de los sensores requieren "
           "calibración en el sitio antes de usarse como referencia.",
}

BLOQUES = []
B = BLOQUES.append

# ---------------------------------------------------------------------------
# RESUMEN
# ---------------------------------------------------------------------------
B(("h1", "Resumen ejecutivo"))
B(("p", "Este documento describe cómo conectar, configurar y probar un sistema de monitoreo para un "
        "reservorio de agua construido sobre un **ESP32 DevKit V1**. El equipo mide cinco variables: "
        "nivel de agua (ultrasónico), caudal (efecto Hall), temperatura (1-Wire), pH y turbidez. "
        "Los datos se muestran en una pantalla LCD local y en un tablero web con una tarjeta por sensor, "
        "pensado para funcionar primero en la red local y, más adelante, publicado en internet."))
B(("p", "El proyecto se entrega en dos mitades independientes. El **firmware** (C++ sobre PlatformIO) "
        "lee los sensores, filtra las señales, guarda la calibración en memoria no volátil y expone una "
        "API HTTP. El **dashboard** (HTML, CSS y JavaScript sin dependencias) consume esa API, dibuja el "
        "estado del tanque y permite calibrar. La misma web funciona servida por el ESP32, desde una "
        "computadora de desarrollo o en modo demostración con datos simulados."))
B(("p", "El estado actual es el siguiente:"))
B(("tabla", {
    "headers": ["Componente", "Estado", "Evidencia"],
    "rows": [
        ["Firmware ESP32", "Compila sin errores", "PlatformIO 6.2.0 · 80.3 % de la partición de aplicación"],
        ["Dashboard web", "Validado en navegador", "Chrome 153 en escritorio (1440 px) y móvil (390 px), sin errores de consola"],
        ["Modo demostración", "Funcional", "Genera telemetría simulada y se activa solo cuando no hay ESP32"],
        ["Montaje físico", "Pendiente", "Procedimiento completo en la parte I de este informe"],
        ["Calibración", "Pendiente", "Requiere los sensores conectados y los buffers de pH"],
        ["Modelo digital 3D", "Anotado para fase posterior", "Ver capítulo 15 y docs/roadmap.md"],
    ],
    "widths": [4.4, 4.2, 8.4],
    "caption": "Estado del proyecto al momento de este informe",
}))
B(("callout", ("importante", "La parte de software está terminada y verificada. La parte física **no se ha "
                             "probado todavía**: este documento es la guía para hacerlo, sensor por sensor, "
                             "sin soldar. No conectes nada antes de leer el capítulo 4.")))
B(("h2", "Cómo usar este informe"))
B(("lista", [
    "Si vas a montar el hardware por primera vez, sigue los capítulos 4 a 6 en orden y prueba cada sensor antes de agregar el siguiente.",
    "Si ya está montado y no funciona, ve directo al capítulo 13 (solución de problemas).",
    "Para calibrar y validar las mediciones, usa los capítulos 11 y 12.",
    "El anexo B es una hoja de referencia rápida para imprimir y tener junto a la protoboard.",
]))

# ---------------------------------------------------------------------------
# PARTE I
# ---------------------------------------------------------------------------
B(("parte", ("I", "Hardware y montaje",
             "Componentes, seguridad eléctrica, distribución de pines y conexión paso a paso "
             "de cada sensor en protoboard, sin soldadura.")))

# ---------------------------------------------------------------------------
# 1. INTRODUCCIÓN
# ---------------------------------------------------------------------------
B(("h1", "1. Introducción y alcance"))
B(("h2", "1.1 Objetivo del sistema"))
B(("p", "Construir un equipo autónomo que vigile un reservorio de agua y permita responder cuatro "
        "preguntas en cualquier momento: cuánta agua hay, si está entrando o saliendo agua, a qué "
        "temperatura está y si su calidad (pH y turbidez) se mantiene dentro de rangos razonables."))
B(("p", "El sistema está pensado para instalarse en un tanque doméstico o comunitario, con acceso a "
        "energía y a una red WiFi de 2.4 GHz. No reemplaza un análisis de laboratorio: entrega "
        "tendencias y alarmas tempranas, y su precisión depende de la calibración descrita en el "
        "capítulo 11."))
B(("h2", "1.2 Alcance de esta versión"))
B(("p", "La **fase 1**, cubierta por este documento, incluye:"))
B(("lista", [
    "Montaje de los cinco sensores y la pantalla sobre una protoboard, sin soldar.",
    "Firmware con lectura no bloqueante, filtros de mediana y calibración persistente.",
    "Dashboard web local con tarjetas por sensor, tanque virtual y panel de diagnóstico.",
    "Procedimientos de calibración y un plan de pruebas con criterios de aceptación.",
]))
B(("p", "Queda **fuera de alcance** de esta fase: la publicación permanente en internet con base de "
        "datos histórica, el modelo digital 3D del reservorio, las notificaciones automáticas y la "
        "actualización remota de firmware. Todo eso está planificado en el capítulo 15."))
B(("h2", "1.3 Estado verificado y criterios de aceptación"))
B(("p", "Es importante distinguir dos cosas. **Verificado** significa que se ejecutó y se observó el "
        "resultado: el firmware se compiló y el dashboard se abrió en un navegador real. **Pendiente** "
        "significa que depende de los sensores físicos y debe hacerse siguiendo esta guía."))
B(("p", "La fase 1 se considerará terminada cuando se cumplan estos criterios:"))
B(("checklist", [
    "Los cinco sensores entregan lecturas coherentes durante 30 minutos continuos.",
    "El dashboard es accesible desde el celular y desde la computadora al mismo tiempo.",
    "El sistema conserva calibración y totalizador de caudal después de reiniciarse.",
    "Ningún GPIO recibe más de 3.3 V (verificado con multímetro).",
    "La placa funciona sin PC, sirviendo el dashboard desde su propia memoria.",
]))
B(("h2", "1.4 Organización del documento"))
B(("tabla", {
    "headers": ["Parte", "Contenido", "Cuándo consultarla"],
    "rows": [
        ["I. Hardware y montaje", "Capítulos 2 a 6", "Antes y durante el armado"],
        ["II. Software y configuración", "Capítulos 7 a 10", "Para preparar la PC y cargar el firmware"],
        ["III. Puesta en marcha", "Capítulos 11 a 15", "Calibración, pruebas y mantenimiento"],
        ["Anexos", "A y B", "Fórmulas, referencia rápida y glosario"],
    ],
    "widths": [4.6, 4.6, 7.8],
    "caption": "Estructura del informe",
}))

# ---------------------------------------------------------------------------
# 2. ARQUITECTURA
# ---------------------------------------------------------------------------
B(("h1", "2. Arquitectura del sistema"))
B(("p", "El sistema tiene tres capas: los sensores, el controlador y la visualización. Los sensores "
        "entregan señales eléctricas; el ESP32 las convierte en magnitudes físicas, las filtra y las "
        "publica; el navegador las presenta. La figura siguiente resume el conjunto."))
B(("imagen", ("arquitectura.png", 16.6, "Arquitectura general. La línea continua corresponde a la fase 1; "
                                        "la discontinua, a la fase 2 planificada.")))
B(("h2", "2.1 Componentes y funciones"))
B(("tabla", {
    "headers": ["Componente", "Magnitud", "Interfaz", "Pin(es)", "Observación"],
    "rows": [
        ["HC-SR04", "Nivel de agua", "2 GPIO (Trigger/Echo)", "19 / 18", "Echo requiere divisor de tensión"],
        ["YF-S201", "Caudal y volumen", "Pulso por interrupción", "23", "450 pulsos por litro"],
        ["DS18B20", "Temperatura", "1-Wire", "4", "Pull-up de 4.7 kΩ a 3.3 V"],
        ["PH-7BNC", "pH", "Analógico", "34 (ADC1)", "Salida dividida a la mitad"],
        ["SEN0189", "Turbidez", "Analógico", "35 (ADC1)", "Salida dividida a la mitad"],
        ["LCD 1602 I2C", "Visualización local", "I2C", "21 / 22", "Dirección 0x27 o 0x3F"],
        ["ESP32 DevKit V1", "Control y WiFi", "—", "—", "30 pines, USB-C"],
    ],
    "widths": [3.4, 3.4, 3.6, 2.4, 4.2],
    "caption": "Componentes del sistema y su interfaz con el controlador",
}))
B(("h2", "2.2 Flujo de datos"))
B(("numeros", [
    "Cada sensor se muestrea en su propio intervalo, sin bloquear el resto del programa.",
    "Las señales analógicas y de distancia pasan por un filtro de mediana para descartar picos.",
    "El ESP32 arma un documento JSON con todas las lecturas y el estado del sistema.",
    "El dashboard consulta `/api/telemetry` cada 1.5 segundos y actualiza tarjetas y gráficas.",
    "Si no hay respuesta, el dashboard entra en modo demostración y lo indica en pantalla.",
]))
B(("p", "El servidor del ESP32 es síncrono y atiende una petición a la vez, suficiente para un tablero "
        "de monitoreo doméstico. Las lecturas que bloquean (medición de eco del ultrasónico, conversión "
        "del pH) están acotadas a decenas de milisegundos y se ejecutan entre peticiones."))
B(("h2", "2.3 Modos de operación"))
B(("tabla", {
    "headers": ["Modo", "Quién sirve la web", "Cuándo usarlo", "Limitación"],
    "rows": [
        ["ESP32 autónomo", "El propio ESP32 (LittleFS)", "Operación normal y acceso desde el celular", "Solo red local"],
        ["Desarrollo local", "Servidor Node en la PC", "Editar el dashboard sin reflashear", "Requiere PC encendida"],
        ["Demostración", "El navegador (datos simulados)", "Presentar el diseño o trabajar sin hardware", "No son datos reales"],
        ["Nube (fase 2)", "Vercel + Supabase", "Acceso remoto e histórico", "Aún no implementado"],
    ],
    "widths": [3.6, 4.8, 4.8, 3.8],
    "caption": "Modos de operación del sistema",
}))

# ---------------------------------------------------------------------------
# 3. MATERIALES
# ---------------------------------------------------------------------------
B(("h1", "3. Materiales y herramientas"))
B(("h2", "3.1 Lista de materiales"))
B(("p", "Estos son los componentes adquiridos para el proyecto, con su identificador de compra:"))
B(("tabla", {
    "headers": ["Componente", "SKU", "Función"],
    "rows": [
        ["Sensor ultrasónico HC-SR04", "J001-HC-SR04", "Nivel de agua"],
        ["Sensor de flujo YF-S201", "F104-YF-S201", "Caudal y volumen"],
        ["Sensor de temperatura DS18B20", "N007-FM1164", "Temperatura del agua"],
        ["Módulo de pH PH-7BNC con sonda BNC", "Q004-SNS-PC-000", "pH"],
        ["Sensor de turbidez SEN0189 / TS-300B", "P001-SEN0189", "Turbidez"],
        ["ESP32 DevKit V1, 30 pines, USB-C", "K016-Devkit", "Controlador y WiFi"],
        ["Pantalla LCD 1602 con backpack I2C", "K013-EP-268", "Visualización local"],
        ["Resistencias de carbón 1/4 W 5 %, 4.7 kΩ", "B313-EP-368-4K7", "Pull-ups y divisores (20 unidades)"],
        ["Cable flat de 40 pines, 1 m", "D101-B09", "Cableado del montaje final"],
    ],
    "widths": [6.2, 4.4, 6.4],
    "caption": "Materiales adquiridos",
}))
B(("h2", "3.2 Compras pendientes para el montaje sin soldadura"))
B(("p", "La lista anterior no alcanza para probar el sistema en protoboard. Falta lo siguiente:"))
B(("tabla", {
    "headers": ["Material", "Cantidad", "Para qué"],
    "rows": [
        ["Protoboard de 830 puntos", "1", "Base de montaje sin soldar"],
        ["Cables dupont macho-macho", "30", "Uniones entre la placa y la protoboard"],
        ["Cables dupont hembra-macho", "15", "Módulos con pines macho (LCD, sensores)"],
        ["Cable USB-C de datos", "1", "Programar y alimentar la placa (no sirve uno solo de carga)"],
        ["Multímetro", "1", "Verificar 5 V, 3.3 V y continuidad antes de energizar"],
        ["Buffer de pH 4.00 y 7.00", "1 de cada uno", "Calibración real del electrodo"],
        ["Solución de almacenamiento KCl", "1", "Conservar húmedo el electrodo de pH"],
    ],
    "widths": [6.2, 3.0, 7.8],
    "caption": "Material adicional necesario para las pruebas",
}))
B(("callout", ("nota", "El cable flat de 40 pines es para el montaje definitivo soldado: no entra en una "
                       "protoboard. Para las pruebas usa cables dupont.")))
B(("h2", "3.3 Herramientas y software"))
B(("tabla", {
    "headers": ["Herramienta", "Uso"],
    "rows": [
        ["PlatformIO (incluido en .venv del proyecto)", "Compilar y cargar el firmware"],
        ["Node.js 18 o superior", "Servidor de desarrollo y copia de la web a LittleFS"],
        ["Navegador Chromium, Chrome o Edge", "Abrir el dashboard y revisar la consola"],
        ["Multímetro", "Medir tensiones y continuidad"],
        ["Destornillador pequeño y pinza", "Ajustes y manipulación de cables"],
        ["Cinta métrica y etiquetas", "Medir el tanque y rotular cables"],
    ],
    "widths": [7.0, 10.0],
    "caption": "Herramientas recomendadas",
}))

# ---------------------------------------------------------------------------
# 4. SEGURIDAD
# ---------------------------------------------------------------------------
B(("h1", "4. Seguridad eléctrica y alimentación"))
B(("p", "El ESP32 funciona con lógica de **3.3 V**, mientras que varios módulos se alimentan con "
        "**5 V** y entregan señales en ese mismo rango. Conectar una salida de 5 V a un GPIO puede "
        "destruir el pin o la placa. Este capítulo establece las reglas que se aplican a todo el montaje."))
B(("h2", "4.1 Reglas obligatorias"))
B(("numeros", [
    "Ningún GPIO del ESP32 debe recibir más de **3.3 V**, ni en modo digital ni analógico.",
    "Los módulos de 5 V se alimentan desde el pin **VIN** (etiquetado también 5V), nunca desde 3V3.",
    "Todos los dispositivos deben compartir **GND**. Sin tierra común las lecturas son erráticas.",
    "**Desconecta el USB** antes de mover cables. Conecta, revisa y recién entonces energiza.",
    "Antes de energizar, revisa dos veces que 5 V no haya caído en un GPIO o en el riel de 3.3 V.",
]))
B(("h2", "4.2 Niveles de tensión de cada señal"))
B(("tabla", {
    "headers": ["Señal", "Sale del sensor", "Pin del ESP32", "Protección necesaria"],
    "rows": [
        ["HC-SR04 Trigger", "3.3 V (acepta)", "GPIO 19", "Ninguna"],
        ["HC-SR04 Echo", "5 V", "GPIO 18", "Divisor de tensión"],
        ["DS18B20 DATA", "3.3 V (drenador abierto)", "GPIO 4", "Pull-up a 3.3 V"],
        ["YF-S201 señal", "Drenador abierto", "GPIO 23", "Pull-up a 3.3 V"],
        ["SEN0189 AO", "Hasta 4.5 V", "GPIO 35", "Divisor de tensión"],
        ["PH-7BNC Po", "Hasta 3.8 V", "GPIO 34", "Divisor de tensión"],
    ],
    "widths": [3.8, 4.6, 3.2, 5.4],
    "caption": "Tensión de cada señal y protección requerida",
}))
B(("callout", ("seguridad", "Si una señal de 5 V llega directa a un GPIO, el pin puede quedar inutilizable "
                           "de forma permanente. El HC-SR04, la turbidez y el pH **siempre** llevan divisor.")))
B(("h2", "4.3 Divisores de tensión"))
B(("p", "Un divisor de tensión reduce la amplitud de una señal usando dos resistencias en serie. La "
        "salida se toma del punto medio. Con dos resistencias iguales de 4.7 kΩ, la tensión se divide "
        "exactamente a la mitad."))
B(("imagen", ("divisor.png", 14.6, "Divisor con dos resistencias iguales: la señal de salida es la mitad de la de entrada.")))
B(("tabla", {
    "headers": ["Señal", "Tensión máxima", "Divisor", "Tensión en el pin", "Factor en el firmware"],
    "rows": [
        ["HC-SR04 Echo", "5.0 V", "4.7 kΩ + 4.7 kΩ", "2.5 V", "No aplica (digital)"],
        ["SEN0189 AO", "4.5 V", "4.7 kΩ + 4.7 kΩ", "2.25 V", "TURBIDITY_DIVIDER = 2.0"],
        ["PH-7BNC Po", "3.8 V", "4.7 kΩ + 4.7 kΩ", "1.9 V", "PH_DIVIDER = 2.0"],
    ],
    "widths": [4.0, 3.4, 4.0, 3.4, 4.2],
    "caption": "Divisores utilizados y su equivalente en el firmware",
}))
B(("p", "Si en lugar de dos resistencias iguales usas 4.7 kΩ y 10 kΩ, la atenuación es menor y se "
        "aprovecha mejor el rango del ADC. En ese caso el factor es 1.47 y hay que cambiarlo en "
        "`firmware/include/config.h`. El factor debe coincidir **siempre** con el hardware: si no, las "
        "lecturas de pH y turbidez serán incorrectas."))
B(("h2", "4.4 Alimentación y consumo"))
B(("tabla", {
    "headers": ["Elemento", "Tensión", "Consumo aproximado"],
    "rows": [
        ["ESP32 con WiFi activo", "5 V (USB o VIN)", "120 mA promedio, picos de 240 mA"],
        ["HC-SR04", "5 V", "15 mA"],
        ["YF-S201", "5 V", "15 mA"],
        ["DS18B20", "3.3 V", "1.5 mA"],
        ["Módulo de pH", "5 V", "10 mA"],
        ["SEN0189", "5 V", "3 mA"],
        ["LCD 1602 con retroiluminación", "5 V", "20 a 40 mA"],
    ],
    "widths": [6.0, 4.0, 7.0],
    "caption": "Consumo estimado de los módulos",
}))
B(("p", "Para pruebas, el puerto USB de la computadora suele alcanzar. Para el montaje definitivo usa "
        "una **fuente externa de 5 V y 2 A**, con el GND unido al del ESP32. Los reinicios aleatorios, "
        "las lecturas que saltan y las desconexiones de WiFi con todos los sensores conectados son "
        "síntomas típicos de alimentación insuficiente."))
B(("callout", ("importante", "No alimentes los módulos de 5 V desde el pin 3V3: el regulador de la placa "
                             "no está dimensionado para eso y la tensión caerá. Tampoco uses el pin VIN "
                             "como salida si alimentas la placa por ese mismo pin con una fuente externa.")))
B(("h2", "4.5 Alimentación portátil con pila de 9 V"))
B(("p", "Para usar el equipo sin computadora se puede alimentar con una pila de 9 V a través de una "
        "placa reguladora con entrada DC de 7–12 V (la que tiene botón, jack DC y puerto USB). La placa "
        "no entrega los 9 V: los regula a 5 V o 3.3 V según el jumper."))
B(("codigo", """Pila 9 V ──jack DC (7-12 V)──► [placa reguladora] ──salida 5 V──► VIN del ESP32
                                                 └─ GND ────────► GND del ESP32"""))
B(("tabla", {
    "headers": ["Control o pin", "Función", "Cómo usarlo"],
    "rows": [
        ["Jack DC in 7–12 V", "Entrada", "Ahí va la pila (centro positivo; verificar)"],
        ["Jumper 5V / OFF / 3.3V", "Selector de salida", "Dejarlo en 5V; OFF corta la salida"],
        ["Rieles + y −", "Salida principal", "+ → VIN, − → GND del ESP32"],
        ["Header 3.3V / 5V / GND", "Salidas auxiliares", "Medir antes de usar"],
        ["Pads + y −", "Entrada o salida extra", "Medir antes de usar"],
        ["Puerto USB", "Puede ser entrada o salida", "Si con la pila hay 5 V, es salida"],
    ],
    "widths": [4.6, 4.6, 7.8],
    "caption": "Controles de la placa reguladora",
}))
B(("p", "**Verificación antes de conectar el ESP32:** mide la pila sola (unos 9 V) y luego la salida "
        "de la placa entre + y − con el jumper en 5V. Debe dar **5.0 a 5.2 V**. Si da 9 V, la placa no "
        "está regulando y no debe usarse."))
B(("lista", [
    "El 3.3 V de la placa no va al pin 3V3 del ESP32 mientras el USB esté conectado.",
    "El 3.3 V tampoco sirve para VIN: el regulador del ESP32 necesita unos 5 V.",
    "Usa una sola fuente a la vez: USB de la PC o placa con pila, nunca ambas.",
    "No conectes la pila de 9 V directo a VIN, al USB ni a ningún GPIO.",
]))
B(("callout", ("importante", "Una pila de 9 V tiene poca capacidad y mucha resistencia interna. Con el "
                             "WiFi activo, los picos de corriente hacen caer la tensión y aparecen "
                             "reinicios y lecturas erráticas aunque el multímetro marque 9 V en reposo. "
                             "Para pruebas cortas sirve; para uso continuo usa 5 V / 2 A o una batería "
                             "de litio con salida USB.")))

# ---------------------------------------------------------------------------
# 5. PINES
# ---------------------------------------------------------------------------
B(("h1", "5. Distribución de pines"))
B(("p", "La placa utilizada es la DevKit V1 de 30 pines. La figura muestra la vista superior con el "
        "USB hacia abajo y las funciones asignadas en este proyecto. **Verifica siempre la serigrafía "
        "de tu placa**: el orden físico cambia entre clones."))
B(("imagen", ("pinout-esp32.png", 15.4, "Distribución de pines del ESP32 DevKit V1 y funciones del proyecto.")))
B(("h2", "5.1 Pines utilizados"))
B(("tabla", {
    "headers": ["GPIO", "Función", "Modo", "Notas"],
    "rows": [
        ["19", "HC-SR04 Trigger", "Salida digital", "Pulso de 10 µs"],
        ["18", "HC-SR04 Echo", "Entrada digital", "Mediante divisor a 2.5 V"],
        ["23", "YF-S201", "Entrada con interrupción", "Pull-up externo a 3.3 V"],
        ["4", "DS18B20", "1-Wire", "Pull-up de 4.7 kΩ a 3.3 V"],
        ["34", "pH", "ADC1, solo entrada", "Sin pull-up interno; divisor"],
        ["35", "Turbidez", "ADC1, solo entrada", "Sin pull-up interno; divisor"],
        ["21", "LCD SDA", "I2C", "Dirección 0x27 o 0x3F"],
        ["22", "LCD SCL", "I2C", "—"],
    ],
    "widths": [2.0, 4.6, 4.4, 6.0],
    "caption": "Asignación de pines del proyecto",
}))
B(("p", "Se usan GPIO 34 y 35 para las señales analógicas porque pertenecen a **ADC1**, que sigue "
        "funcionando con el WiFi activo. Los canales de ADC2 (GPIO 0, 2, 4, 12–15, 25–27) no son "
        "confiables mientras el radio está encendido. Tampoco se usan GPIO 6 a 11, reservados para la "
        "memoria flash, ni los pines de arranque 0, 2, 12 y 15."))
B(("h2", "5.2 Tabla maestra de conexiones"))
B(("tabla", {
    "headers": ["Sensor", "VCC", "GND", "Señal", "Componente extra"],
    "rows": [
        ["HC-SR04", "5 V (VIN)", "GND", "TRIG → 19 · ECHO → 18", "Divisor 4.7 kΩ + 4.7 kΩ en ECHO"],
        ["YF-S201", "5 V (VIN)", "GND", "Señal → 23", "Pull-up 4.7 kΩ a 3.3 V"],
        ["DS18B20", "3.3 V", "GND", "DATA → 4", "Pull-up 4.7 kΩ a 3.3 V"],
        ["SEN0189", "5 V (VIN)", "GND", "AO → 35", "Divisor 4.7 kΩ + 4.7 kΩ"],
        ["PH-7BNC", "5 V (VIN)", "GND", "Po → 34", "Divisor 4.7 kΩ + 4.7 kΩ"],
        ["LCD 1602 I2C", "5 V (VIN)", "GND", "SDA → 21 · SCL → 22", "Ninguno"],
    ],
    "widths": [3.4, 3.0, 2.2, 4.6, 6.0],
    "caption": "Resumen de conexiones de todos los componentes",
}))

# ---------------------------------------------------------------------------
# 6. CONEXIÓN
# ---------------------------------------------------------------------------
B(("h1", "6. Conexión de los componentes"))
B(("p", "Este capítulo es el procedimiento de armado. El orden elegido reduce el riesgo de errores: "
        "primero la pantalla (da retroalimentación inmediata), después los sensores digitales y al "
        "final los analógicos y el pH, que son los más delicados. **Prueba cada componente antes de "
        "conectar el siguiente.**"))
B(("callout", ("tip", "Deja el monitor serie abierto mientras trabajas. Los mensajes del firmware "
                      "indican qué sensor no responde y permiten distinguir un problema de cableado de "
                      "uno de software.")))

B(("h2", "6.1 Preparación de la protoboard"))
B(("imagen", ("protoboard.png", 16.2, "Disposición general: el ESP32 a caballo del canal central, los rieles de alimentación y las filas de conexión.")))
B(("numeros", [
    "Desconecta el cable USB del ESP32.",
    "Coloca el ESP32 en el extremo izquierdo de la protoboard, a caballo del canal central, con una fila de pines de cada lado.",
    "Conecta el pin VIN (o 5V) de la placa al riel rojo con un cable dupont.",
    "Conecta un pin GND de la placa al riel azul.",
    "Si los rieles están partidos en el medio, únelos con un puente en cada lado.",
    "Deja libre el resto de la protoboard para los módulos y los divisores.",
]))
B(("p", "Antes de continuar, mide con el multímetro:"))
B(("checklist", [
    "Riel rojo contra riel azul: 5 V (con el USB conectado).",
    "Pin 3V3 contra riel azul: 3.3 V.",
    "Ningún GPIO tiene 5 V.",
    "No hay continuidad entre el riel rojo y el azul (no hay cortocircuito).",
]))

B(("h2", "6.2 Pantalla LCD 1602 I2C"))
B(("p", "La pantalla muestra cuatro páginas rotativas con nivel, temperatura, caudal y turbidez. "
        "El backpack I2C reduce la conexión a cuatro cables y permite detectar la dirección por software."))
B(("tabla", {
    "headers": ["Pin del backpack", "Va a", "Notas"],
    "rows": [
        ["GND", "Riel azul (GND)", "—"],
        ["VCC", "Riel rojo (5 V)", "La retroiluminación consume corriente"],
        ["SDA", "GPIO 21", "Datos I2C"],
        ["SCL", "GPIO 22", "Reloj I2C"],
    ],
    "widths": [4.2, 5.0, 7.8],
    "caption": "Conexión de la pantalla LCD",
}))
B(("p", "El orden de los cuatro pines cambia entre módulos: guíate por la serigrafía y no por el color "
        "del cable. Al arrancar, el firmware recorre el bus I2C y usa la dirección que encuentre "
        "(normalmente `0x27`; algunos módulos usan `0x3F`). En el monitor serie aparece el mensaje "
        "`[lcd] pantalla en 0x27`."))
B(("p", "**Prueba de banco**"))
B(("numeros", [
    "Conecta el USB y abre el monitor serie.",
    "Confirma el mensaje de detección de la pantalla.",
    "Debe aparecer «Reservorio / iniciando…» y luego rotar las cuatro páginas cada 2.5 segundos.",
    "Ajusta el contraste con el potenciómetro del backpack hasta que el texto se lea sin fantasmas.",
]))
B(("p", "**Si no funciona:** pantalla encendida sin texto → contraste; sin mensaje en el monitor → "
        "SDA/SCL invertidos o falta 5 V; caracteres basura → contacto flojo en los pines."))

B(("h2", "6.3 Sensor de temperatura DS18B20"))
B(("p", "La sonda es impermeable y se conecta por tres cables. La resistencia de 4.7 kΩ entre DATA y "
        "3.3 V es obligatoria: sin ella el sensor no aparece en el bus."))
B(("tabla", {
    "headers": ["Cable", "Va a", "Notas"],
    "rows": [
        ["Rojo (VDD)", "3V3", "No usar 5 V para no exponer el bus a ese nivel"],
        ["Negro (GND)", "Riel azul", "—"],
        ["Amarillo (DATA)", "GPIO 4", "Con resistencia de 4.7 kΩ a 3V3"],
    ],
    "widths": [4.2, 4.6, 8.2],
    "caption": "Conexión del DS18B20",
}))
B(("codigo", "3V3 ──[ 4.7k ]──┬── GPIO 4\n                  │\n               DATA (amarillo)"))
B(("p", "**Prueba de banco**"))
B(("numeros", [
    "En el monitor serie debe aparecer una temperatura cercana a la ambiente.",
    "Sujeta la parte metálica con los dedos durante 30 segundos: la lectura debe subir lentamente.",
    "Sumérgela en un vaso con agua y hielo: debe bajar hacia 0 °C. Solo la parte metálica, nunca el cable.",
]))
B(("p", "**Si no funciona:** lectura `nan` o `-127` → falta la resistencia, DATA en otro GPIO o cables "
        "invertidos. Un valor fijo extraño suele indicar un mal contacto en el conector dupont."))

B(("h2", "6.4 Sensor ultrasónico HC-SR04"))
B(("p", "Mide la distancia al agua desde la tapa del tanque. El Trigger acepta 3.3 V, pero el Echo "
        "entrega 5 V: necesita divisor. Sin él, el GPIO 18 queda expuesto a una tensión que lo daña."))
B(("tabla", {
    "headers": ["Pin del sensor", "Va a", "Notas"],
    "rows": [
        ["VCC", "Riel rojo (5 V)", "Alimentar a 3.3 V degrada la medición"],
        ["GND", "Riel azul", "—"],
        ["Trig", "GPIO 19", "Directo"],
        ["Echo", "GPIO 18", "A través del divisor"],
    ],
    "widths": [4.2, 4.6, 8.2],
    "caption": "Conexión del HC-SR04",
}))
B(("codigo", "ECHO ──[ 4.7k ]──┬── GPIO 18\n                 │\n              [ 4.7k ]\n                 │\n                GND"))
B(("p", "**Prueba de banco**"))
B(("numeros", [
    "Coloca el sensor frente a una pared o al techo, a 30 cm medidos con cinta.",
    "En la tarjeta «Nivel», el campo «Distancia» debe rondar 30 cm con tolerancia de ±1 cm.",
    "Aleja y acerca la mano: la distancia debe seguir el movimiento.",
    "Sin obstáculo o a más de 4 metros, debe mostrar «--», nunca un valor absurdo.",
]))
B(("p", "**Si no funciona:** distancia siempre 0 o «--» → divisor mal conectado o Trigger/Echo "
        "invertidos; lecturas inestables → superficie inclinada o eco débil. Para el montaje final, "
        "considera un tubo guía de PVC para proteger el sensor de la condensación."))
B(("callout", ("nota", "En la mesa el porcentaje de nivel puede parecer incorrecto: se calcula como "
                       "«altura del tanque − distancia». Con el tanque configurado en 100 cm y el sensor "
                       "a 30 cm del obstáculo, mostrará 70 %. Durante las pruebas mira la distancia, no el porcentaje.")))

B(("h2", "6.5 Sensor de caudal YF-S201"))
B(("p", "El sensor genera pulsos al girar su rotor: 450 pulsos equivalen a un litro. La señal es de "
        "colector abierto, por lo que se alimenta a 5 V pero se mantiene en 3.3 V con una resistencia "
        "de pull-up, sin exponer el GPIO."))
B(("tabla", {
    "headers": ["Cable", "Va a", "Notas"],
    "rows": [
        ["Rojo (VCC)", "Riel rojo (5 V)", "—"],
        ["Negro (GND)", "Riel azul", "—"],
        ["Amarillo (señal)", "GPIO 23", "Con resistencia de 4.7 kΩ a 3V3"],
    ],
    "widths": [4.2, 4.6, 8.2],
    "caption": "Conexión del YF-S201",
}))
B(("codigo", "3V3 ──[ 4.7k ]──┬── GPIO 23\n                  │\n              señal (amarillo)"))
B(("p", "**Prueba de banco**"))
B(("numeros", [
    "Sopla suavemente por la entrada del sensor: el rotor debe girar.",
    "En la tarjeta «Caudal», los L/min suben mientras hay flujo y vuelven a cero al detenerse.",
    "El acumulado sigue subiendo aunque dejes de soplar; no se reinicia solo.",
    "Prueba el botón «Reiniciar total» en el panel de diagnóstico: debe volver a cero.",
]))
B(("p", "**Si no funciona:** caudal siempre 0 → falta el pull-up o el cable no hace contacto; cuentas "
        "que se detienen solas → conector flojo; cuentas de más → ruido en un cable largo. Respeta la "
        "flecha de flujo grabada en el cuerpo del sensor."))

B(("h2", "6.6 Sensor de turbidez SEN0189"))
B(("p", "Es un sensor óptico: mide cuánta luz atraviesa el agua. Su salida llega a 4.5 V en agua clara, "
        "por lo que **siempre** requiere divisor antes del GPIO 35. El valor se informa en NTU y como "
        "porcentaje de claridad referido al agua clara calibrada."))
B(("tabla", {
    "headers": ["Pin del sensor", "Va a", "Notas"],
    "rows": [
        ["+ / VCC", "Riel rojo (5 V)", "—"],
        ["− / GND", "Riel azul", "—"],
        ["A / AOUT", "GPIO 35", "A través del divisor"],
    ],
    "widths": [4.2, 4.6, 8.2],
    "caption": "Conexión del SEN0189",
}))
B(("p", "**Prueba de banco**"))
B(("numeros", [
    "Llena un vaso con agua de la canilla y sumerge el sensor hasta la marca; la electrónica queda afuera.",
    "La tarjeta debe mostrar NTU bajo y claridad alta.",
    "Agrega una gota de leche o una pizca de tierra y revuelve: el NTU sube y la claridad baja.",
    "En diagnóstico, el voltaje debe rondar 4.0 a 4.3 V en agua clara (ya compensado el divisor).",
]))
B(("p", "**Si no funciona:** voltaje cercano a 0 → divisor o pin A desconectado; voltaje mayor a 4.5 V → "
        "divisor mal armado, no lo dejes así; lecturas que saltan → burbujas adheridas al lente. "
        "Limpia el lente con agua destilada y un paño suave."))

B(("h2", "6.7 Sensor de pH PH-7BNC"))
B(("p", "Es el sensor más delicado. El módulo entrega una tensión proporcional al pH (alrededor de "
        "2.5 V en pH 7) y la sonda debe permanecer húmeda. Conéctal -lo al final, cuando el resto ya "
        "funcione, y manipula el electrodo con cuidado."))
B(("tabla", {
    "headers": ["Pin del módulo", "Va a", "Notas"],
    "rows": [
        ["VCC", "Riel rojo (5 V)", "—"],
        ["GND", "Riel azul", "—"],
        ["Po", "GPIO 34", "Salida analógica, a través del divisor"],
        ["Do", "Sin conectar", "Comparador digital, no se usa"],
        ["To", "Sin conectar", "Salida de temperatura, no se usa"],
    ],
    "widths": [4.2, 4.6, 8.2],
    "caption": "Conexión del módulo de pH",
}))
B(("codigo", "Po ──[ 4.7k ]──┬── GPIO 34\n               │\n            [ 4.7k ]\n               │\n              GND"))
B(("p", "**Prueba de banco**"))
B(("numeros", [
    "Retira el protector del electrodo y enjuágalo con agua destilada.",
    "Sumérgelo en agua potable y espera 60 segundos.",
    "La tarjeta debe mostrar un pH entre 6.5 y 8.5; sin calibrar es un valor provisional.",
    "En diagnóstico, el voltaje debe moverse al cambiar de líquido y mantenerse estable.",
]))
B(("p", "**Si no funciona:** pH pegado a 0 o 14 → entrada saturada, falta el divisor o el módulo está "
        "a 5 V sin dividir; lectura inestable → ruido eléctrico o electrodo seco; no cambia entre "
        "buffers → electrodo agotado o Po desconectado."))
B(("callout", ("seguridad", "El electrodo de pH no debe secarse. Guárdalo en solución KCl (o, mientras "
                           "tanto, en un vaso con agua) y no lo dejes sumergido en agua corriente durante "
                           "semanas. No toques el bulbo de vidrio con los dedos.")))

B(("h2", "6.8 Revisión final del cableado"))
B(("checklist", [
    "Cada módulo tiene VCC en el riel correcto (5 V o 3.3 V según la tabla).",
    "Todos los GND llegan al riel azul y este al GND del ESP32.",
    "Los tres divisores están en ECHO, AO y Po, con el punto medio hacia el GPIO.",
    "Los pull-ups de DS18B20 y YF-S201 van a 3.3 V, no a 5 V.",
    "No hay cables cruzando los módulos ni conectores a medio insertar.",
    "Tomaste una foto de la protoboard funcionando: será tu referencia al soldar.",
]))

# ---------------------------------------------------------------------------
# PARTE II
# ---------------------------------------------------------------------------
B(("parte", ("II", "Software y configuración",
             "Preparación del entorno, configuración del firmware, compilación, carga y "
             "funcionamiento del dashboard web.")))

# ---------------------------------------------------------------------------
# 7. ENTORNO
# ---------------------------------------------------------------------------
B(("h1", "7. Preparación del entorno"))
B(("h2", "7.1 Requisitos de software"))
B(("tabla", {
    "headers": ["Herramienta", "Versión usada", "Función"],
    "rows": [
        ["PlatformIO Core", "6.2.0", "Compilar y cargar el firmware"],
        ["Framework Arduino para ESP32", "última del platform espressif32", "Núcleo del firmware"],
        ["Node.js", "26.13", "Servidor local y sincronización de la web"],
        ["Chromium / Chrome", "153", "Dashboard y verificación"],
        ["Controlador USB CH340 o CP210x", "según la placa", "Comunicación por USB"],
    ],
    "widths": [5.0, 4.6, 7.4],
    "caption": "Software utilizado",
}))
B(("p", "En esta computadora PlatformIO ya está instalado dentro de la carpeta `.venv` del proyecto y "
        "los scripts de la carpeta `tools` lo usan automáticamente. Node también está disponible. "
        "**No hay npm instalado**, por eso todos los comandos de este informe usan `node` y "
        "`./tools/pio.sh` en lugar de `npm run`."))
B(("h2", "7.2 Reconocer la placa y el puerto"))
B(("codigo", "cd ~/Proyectos/Reservorio_Agua\nls /dev/ttyUSB* /dev/ttyACM*\n.venv/bin/pio device list"))
B(("p", "El puerto suele ser `/dev/ttyUSB0` (chip CH340) o `/dev/ttyACM0` (CP2102). Si aparece pero da "
        "«permiso denegado», agrega tu usuario al grupo `dialout` y vuelve a iniciar sesión:"))
B(("codigo", "sudo usermod -aG dialout $USER"))
B(("p", "Si no aparece ningún puerto, revisa el cable (debe ser de datos), prueba otro puerto USB y "
        "consulta `dmesg | tail -20` para ver si el sistema detectó el adaptador."))
B(("h2", "7.3 Instalación de PlatformIO (si hiciera falta)"))
B(("codigo", "python3 -m venv .venv\n.venv/bin/pip install platformio\n.venv/bin/pio --version"))
B(("h2", "7.4 Comandos del proyecto"))
B(("tabla", {
    "headers": ["Acción", "Comando"],
    "rows": [
        ["Compilar el firmware", "./tools/pio.sh run -d firmware"],
        ["Compilar y subir", "./tools/pio.sh run -d firmware -t upload"],
        ["Abrir el monitor serie", "./tools/pio.sh device monitor -d firmware -b 115200"],
        ["Servir el dashboard en la PC", "node tools/dev-server.js"],
        ["Apuntar el servidor al ESP32", "ESP32_URL=http://192.168.1.50 node tools/dev-server.js"],
        ["Copiar la web a firmware/data", "node tools/sync-web.js"],
        ["Subir la web al ESP32", "./tools/pio.sh run -d firmware -t uploadfs"],
    ],
    "widths": [6.4, 10.6],
    "caption": "Comandos habituales",
}))

# ---------------------------------------------------------------------------
# 8. FIRMWARE
# ---------------------------------------------------------------------------
B(("h1", "8. Configuración del firmware"))
B(("p", "El firmware está escrito en C++ sobre Arduino para ESP32. Cada sensor tiene su propia clase, "
        "el almacenamiento de calibración usa la memoria NVS y el servidor HTTP sirve la web y la API. "
        "El código está preparado para que un sensor desconectado no bloquee el resto."))
B(("h2", "8.1 Estructura del firmware"))
B(("tabla", {
    "headers": ["Archivo", "Responsabilidad"],
    "rows": [
        ["src/main.cpp", "Arranque, WiFi, mDNS, bucle principal y monitor serie"],
        ["include/config.h", "Pines, tiempos y valores por defecto"],
        ["include/secrets.h", "Credenciales WiFi (local, ignorado por Git)"],
        ["src/ConfigStore.*", "Calibración y totalizador persistidos en NVS"],
        ["src/Telemetry.*", "Armado del JSON de telemetría"],
        ["src/sensors/*", "Una clase por sensor (nivel, caudal, temperatura, pH, turbidez)"],
        ["src/Display.*", "Pantalla LCD y rotación de páginas"],
        ["src/web/WebUI.*", "Servidor HTTP, API y archivos estáticos"],
        ["src/util/MedianFilter.h", "Filtro de mediana sin memoria dinámica"],
    ],
    "widths": [6.0, 11.0],
    "caption": "Organización del código del firmware",
}))
B(("h2", "8.2 Credenciales WiFi"))
B(("p", "El archivo `secrets.h` no se publica: el repositorio incluye `secrets.example.h` con valores "
        "de ejemplo. Cópialo una vez con `cp firmware/include/secrets.example.h firmware/include/secrets.h` "
        "y edita el archivo local con los datos de tu red. Debe ser una red de 2.4 GHz: el ESP32 no "
        "puede conectarse a redes de 5 GHz."))
B(("codigo", "#pragma once\n\n#define WIFI_SSID \"NombreDeTuRed\"\n#define WIFI_PASS \"TuClave\""))
B(("p", "Si dejas los valores de ejemplo o la red no responde en 15 segundos, la placa crea un punto "
        "de acceso llamado **Reservorio-Setup** con clave **reservorio** y publica el dashboard en "
        "`http://192.168.4.1`. Cuando la red configurada vuelve a estar disponible, el firmware "
        "reintenta la conexión cada 20 segundos."))
B(("h2", "8.3 Pines y constantes"))
B(("p", "`config.h` concentra todo lo que puede necesitar un ajuste. Este es un extracto:"))
B(("codigo", """#define PIN_TRIG        19
#define PIN_ECHO        18
#define PIN_FLOW        23
#define PIN_ONEWIRE      4
#define PIN_PH_ADC      34
#define PIN_TURB_ADC    35
#define PIN_I2C_SDA     21
#define PIN_I2C_SCL     22

constexpr float PH_DIVIDER        = 2.0f;
constexpr float TURBIDITY_DIVIDER = 2.0f;
constexpr float DEFAULT_TANK_HEIGHT_CM   = 100.0f;
constexpr float TANK_DIAMETER_CM         = 80.0f;"""))
B(("tabla", {
    "headers": ["Constante", "Valor", "Qué controla"],
    "rows": [
        ["PH_DIVIDER", "2.0", "Factor del divisor del pH (2.0 con 4.7k + 4.7k)"],
        ["TURBIDITY_DIVIDER", "2.0", "Factor del divisor de turbidez"],
        ["DEFAULT_TANK_HEIGHT_CM", "100", "Altura inicial del tanque, ajustable desde la web"],
        ["TANK_DIAMETER_CM", "80", "Diámetro para estimar litros"],
        ["DEFAULT_FLOW_PPL", "450", "Pulsos por litro del YF-S201"],
        ["DEFAULT_PH_NEUTRAL_V", "2.50", "Tensión en buffer pH 7 (se recalibra)"],
        ["DEFAULT_PH_SLOPE_V", "0.18", "Voltios por unidad de pH"],
        ["DEFAULT_TURB_CLEAR_V", "4.20", "Tensión del agua clara"],
    ],
    "widths": [5.4, 2.6, 9.0],
    "caption": "Constantes principales de configuración",
}))
B(("callout", ("importante", "Si cambias el hardware del divisor, cambia también su constante. Con "
                             "`PH_DIVIDER = 2.0` pero sin divisor físico, el pH calculado será aproximadamente "
                             "el doble de desviado del neutro; con el divisor puesto y factor 1.0, ocurre lo contrario.")))
B(("h2", "8.4 Calibración persistente"))
B(("p", "La calibración y el volumen acumulado se guardan en la memoria NVS con el espacio de nombres "
        "`reserv`. Sobreviven a reinicios y a la actualización del firmware. Se pueden consultar y "
        "modificar por HTTP o desde el panel del dashboard."))
B(("tabla", {
    "headers": ["Parámetro", "Valor por defecto", "Cómo se ajusta"],
    "rows": [
        ["Altura del tanque", "100 cm", "Formulario del dashboard o POST /api/config"],
        ["Offset del sensor", "0 cm", "Formulario del dashboard"],
        ["Tensión de neutro del pH", "2.50 V", "Botón «Buffer pH 7»"],
        ["Pendiente del pH", "0.18 V/pH", "Botón «Buffer pH 4»"],
        ["Tensión de agua clara", "4.20 V", "Botón «Agua clara»"],
        ["Pulsos por litro", "450", "POST /api/config (avanzado)"],
        ["Volumen acumulado", "0 L", "Se guarda cada 30 segundos; se reinicia por API"],
    ],
    "widths": [5.2, 3.2, 8.6],
    "caption": "Parámetros persistidos en NVS",
}))
B(("h2", "8.5 Lógica de medición"))
B(("tabla", {
    "headers": ["Magnitud", "Frecuencia", "Filtro", "Condición de error"],
    "rows": [
        ["Nivel", "1 s (3 muestras)", "Mediana de 5", "Sin eco durante 3 ciclos"],
        ["Caudal", "Ventana de 1 s", "Conteo por interrupción", "Siempre operativo"],
        ["Temperatura", "1 s (conversión 750 ms)", "—", "3 lecturas inválidas seguidas"],
        ["pH", "500 ms", "Mediana de 15", "ADC saturado o valor fuera de rango"],
        ["Turbidez", "500 ms", "Mediana de 15", "ADC saturado"],
    ],
    "widths": [3.2, 4.8, 4.6, 4.4],
    "caption": "Frecuencias de muestreo y criterios de error",
}))
B(("p", "Las fórmulas completas, con ejemplos numéricos, están en el anexo A. El nivel se calcula con "
        "la altura configurada y la distancia medida; el volumen se estima como un cilindro; el caudal "
        "se obtiene de los pulsos por segundo; el pH usa una recta de dos puntos y la turbidez, la curva "
        "del fabricante."))
B(("callout", ("nota", "Cuando un sensor falla, la API devuelve `null` en su valor y `ok: false`, y el "
                       "dashboard muestra «--». El tanque conserva el último nivel conocido en lugar de "
                       "vaciarse de golpe.")))

# ---------------------------------------------------------------------------
# 9. COMPILACIÓN
# ---------------------------------------------------------------------------
B(("h1", "9. Compilación y carga"))
B(("h2", "9.1 Compilar y subir el firmware"))
B(("codigo", "./tools/pio.sh run -d firmware              # compilar\n./tools/pio.sh run -d firmware -t upload    # compilar y subir"))
B(("p", "La primera compilación descarga el toolchain y las librerías (varios minutos). Las siguientes "
        "tardan segundos. Al final debe aparecer `[SUCCESS]` y un resumen como este:"))
B(("codigo", "RAM:   [==        ]  15.9% (used 51968 bytes from 327680 bytes)\nFlash: [========  ]  80.3% (used 1051908 bytes from 1310720 bytes)\n========================= [SUCCESS] ========================="))
B(("p", "Si la carga falla con `Failed to connect` o `Timed out waiting for packet header`, deja la "
        "placa en modo descarga: mantén pulsado **BOOT**, pulsa y suelta **EN/RST**, y suelta BOOT. "
        "Vuelve a intentar. Si persiste, baja la velocidad de carga a 115200 en `platformio.ini` o "
        "cambia el cable USB."))
B(("h2", "9.2 Primer arranque"))
B(("p", "Abre el monitor serie con `./tools/pio.sh device monitor -d firmware -b 115200`. Un arranque "
        "normal sin sensores se ve así:"))
B(("codigo", """=== Reservorio de Agua - ESP32 ===
[wifi] conectando a "MiRed".....
[wifi] OK  IP: 192.168.1.50  RSSI: -58 dBm
[mdns] http://reservorio.local
[lcd] no se encontro pantalla I2C
[web] http://192.168.1.50/
[sistema] listo
[datos] nivel=nan% temp=nanC pH=nan flujo=0.00L/min total=0.00L ..."""))
B(("p", "Es normal que los valores digan `nan` o «--» si no hay sensores. Lo importante es que la placa "
        "no se reinicie y que muestre una dirección IP. Si aparece `Brownout detector` o "
        "`Guru Meditation`, revisa la alimentación y el cableado."))
B(("h2", "9.3 Cargar el dashboard en el ESP32"))
B(("p", "La placa guarda la web en una partición LittleFS. Hay que copiar los archivos y subirlos:"))
B(("codigo", "node tools/sync-web.js\n./tools/pio.sh run -d firmware -t uploadfs"))
B(("p", "Después del `uploadfs`, reinicia la placa o espera unos segundos. El dashboard queda "
        "disponible en `http://reservorio.local` o en la IP que muestre el monitor serie. Si ves la "
        "página de aviso «Firmware OK, dashboard sin instalar», significa que faltó el `uploadfs`."))
B(("h2", "9.4 Modo punto de acceso"))
B(("p", "Sin red configurada o si la red no está disponible, la placa levanta `Reservorio-Setup` "
        "(clave `reservorio`). Conéctate desde el celular y abre `http://192.168.4.1`. Este modo sirve "
        "para configurar el equipo en campo, sin router. La contraseña es fija: cámbiala en "
        "`config.h` si el equipo va a quedar en un lugar público."))

# ---------------------------------------------------------------------------
# 10. DASHBOARD
# ---------------------------------------------------------------------------
B(("h1", "10. Dashboard web y API"))
B(("p", "El tablero tiene una portada con el tanque virtual, seis tarjetas (una por sensor más el "
        "estado del sistema) y un panel de diagnóstico con lecturas crudas, ajustes y calibración. "
        "Está diseñado para leerse también en el celular."))
B(("imagen", ("dashboard-escritorio.png", 16.6, "Dashboard en modo demostración, vista de escritorio.")))
B(("h2", "10.1 Modos de visualización"))
B(("tabla", {
    "headers": ["Modo", "Cómo se activa", "Indicador en pantalla"],
    "rows": [
        ["ESP32", "Automático al abrir la web desde la placa o el proxy local", "「ESP32 · 192.168.x.x」 en verde"],
        ["Demostración", "Automático si no hay respuesta; o selector «Demo»", "「Demo · sin hardware」 en ámbar"],
        ["Forzado ESP32", "Selector «ESP32»", "「ESP32 sin conexión」 si falla"],
    ],
    "widths": [3.6, 7.4, 6.0],
    "caption": "Modos del dashboard",
}))
B(("p", "En modo demostración los datos se generan con una simulación que sube y baja el nivel, "
        "acumula litros y varía pH y turbidez. Sirve para revisar el diseño y para publicar una demo, "
        "pero **no representa mediciones reales**. El botón de calibración se desactiva en ese modo."))
B(("imagen", ("dashboard-movil.png", 7.6, "Vista móvil: el tanque, el nivel y las tarjetas se apilan en una columna.")))
B(("h2", "10.2 API HTTP"))
B(("tabla", {
    "headers": ["Método", "Ruta", "Descripción"],
    "rows": [
        ["GET", "/api/telemetry", "Todas las lecturas y el estado del sistema"],
        ["GET", "/api/config", "Altura del tanque y parámetros de calibración"],
        ["POST", "/api/config", "Actualiza altura, offset y pulsos por litro"],
        ["POST", "/api/reset", "Reinicia el totalizador de caudal"],
        ["POST", "/api/calibrate", "Calibra pH 7, pH 4, pH 10 o agua clara"],
        ["POST", "/api/reboot", "Reinicia la placa"],
    ],
    "widths": [2.0, 4.6, 10.4],
    "caption": "Rutas de la API del ESP32",
}))
B(("p", "Ejemplo de respuesta de telemetría (abreviada):"))
B(("codigo", """{
  "ts": 123456, "uptime": 1800,
  "wifi": { "connected": true, "ip": "192.168.1.50", "rssi": -58 },
  "level": { "ok": true, "distanceCm": 34.7, "levelCm": 65.3, "percent": 65.3, "liters": 328.1 },
  "flow": { "ok": true, "lpm": 4.14, "totalL": 135.1, "pulses": 60789 },
  "temperature": { "ok": true, "c": 22.4 },
  "ph": { "ok": true, "value": 7.24, "voltage": 2.46, "raw": 3049 },
  "turbidity": { "ok": true, "ntu": 11, "clarity": 75, "voltage": 3.99, "raw": 4951 },
  "system": { "heap": 214000, "sensorsOk": 5, "sensorsTotal": 5 }
}"""))
B(("p", "Ejemplos con `curl`:"))
B(("codigo", """curl http://reservorio.local/api/telemetry | jq

curl -X POST http://reservorio.local/api/config \\
     -H 'Content-Type: application/json' -d '{"tankHeightCm":120}'

curl -X POST http://reservorio.local/api/calibrate \\
     -H 'Content-Type: application/json' -d '{"sensor":"ph7"}'"""))
B(("h2", "10.3 Servidor local de desarrollo"))
B(("p", "Para editar el dashboard sin reflashear la placa, sirve la carpeta `web` desde la computadora. "
        "El servidor hace de proxy hacia el ESP32 si se le indica la dirección:"))
B(("codigo", "node tools/dev-server.js\nESP32_URL=http://192.168.1.50 node tools/dev-server.js"))
B(("h2", "10.4 Publicación en Vercel (fase 2)"))
B(("p", "El repositorio incluye un `vercel.json` que publica la carpeta `web` como sitio estático. Sin "
        "un backend, la página funciona en modo demostración. Para mostrar datos reales hace falta un "
        "puente en la nube, porque una página HTTPS no puede consultar directamente un ESP32 HTTP de "
        "la red local (contenido mixto y NAT)."))
B(("numeros", [
    "Crear el proyecto en Vercel apuntando al repositorio; el `outputDirectory` ya está definido.",
    "Definir las variables de entorno de Supabase cuando se implemente la fase 2.",
    "Agregar en el firmware el envío periódico de lecturas por HTTPS a Supabase.",
    "Leer la última lectura desde el dashboard y, opcionalmente, el histórico.",
]))
B(("callout", ("nota", "Abrir el dashboard en Vercel y esperar datos del ESP32 no va a funcionar: el "
                       "navegador bloquea la llamada. La demo es la única función prevista en la nube "
                       "hasta completar la fase 2.")))

# ---------------------------------------------------------------------------
# PARTE III
# ---------------------------------------------------------------------------
B(("parte", ("III", "Puesta en marcha",
             "Calibración de cada magnitud, plan de pruebas con criterios de aceptación, "
             "resolución de problemas y mantenimiento.")))

# ---------------------------------------------------------------------------
# 11. CALIBRACIÓN
# ---------------------------------------------------------------------------
B(("h1", "11. Calibración"))
B(("p", "Los valores de fábrica permiten arrancar, pero no son mediciones confiables hasta calibrar. "
        "Todos los parámetros se guardan en la placa y se pueden repetir cuando haga falta. Calibra "
        "siempre con el sensor instalado en su posición definitiva o en una condición equivalente."))
B(("h2", "11.1 Nivel (HC-SR04)"))
B(("numeros", [
    "Mide la altura interior del tanque, desde el fondo hasta el sensor, y guárdala en «Ajustes del tanque».",
    "Con el tanque lleno hasta el rebosadero, observa el porcentaje que muestra el dashboard.",
    "Ajusta el offset del sensor hasta que marque 100 %. La fórmula es nivel = altura − distancia − offset.",
    "Comprueba con cinta métrica a 25, 50 y 75 %. La tolerancia esperada es de ±1 cm.",
]))
B(("p", "Si la superficie del agua está agitada, el eco se dispersa y la lectura salta. Un tubo guía "
        "de PVC de 5 cm de diámetro bajo el sensor mejora mucho la estabilidad. En tanques metálicos, "
        "separa el sensor al menos 10 cm del borde para evitar rebotes."))
B(("h2", "11.2 pH (PH-7BNC)"))
B(("numeros", [
    "Enjuaga el electrodo con agua destilada y sécalo suavemente sin frotar.",
    "Sumérgelo en buffer 7.00, agita y espera 60 segundos.",
    "Pulsa «Buffer pH 7» en el dashboard. El firmware promedia 20 lecturas y guarda el neutro.",
    "Enjuaga, sumerge en buffer 4.00, espera y pulsa «Buffer pH 4». Se calcula la pendiente.",
    "Vuelve al buffer 7: debe leer 7.00 ± 0.1. Si no, repite o ajusta el potenciómetro de offset del módulo.",
]))
B(("p", "La fórmula implementada es pH = 7 + (V_neutro − V_medido) / pendiente. La temperatura afecta "
        "levemente la pendiente del electrodo; para uso doméstico se ignora. Recalibra cada 4 a 8 "
        "semanas en uso continuo."))
B(("h2", "11.3 Turbidez (SEN0189)"))
B(("numeros", [
    "Llena un vaso con agua destilada o potable limpia, a la temperatura del tanque.",
    "Sumerge el sensor hasta la marca, sin tocar las paredes, y espera 30 segundos.",
    "Pulsa «Agua clara». Se guarda la tensión de referencia.",
    "Verifica que el agua clara dé un NTU bajo y una claridad cercana al 100 %.",
]))
B(("p", "La fórmula NTU del fabricante es aproximada y sirve para tendencias. Si el agua clara marca "
        "un NTU alto, revisa burbujas en el lente, el divisor y la alimentación de 5 V."))
B(("h2", "11.4 Caudal (YF-S201)"))
B(("numeros", [
    "Llena un balde de 10 litros cronometrando el tiempo.",
    "Compara los litros que reporta el dashboard con los reales.",
    "Ajusta los pulsos por litro con la relación: nuevo valor = 450 × (litros reportados / litros reales).",
]))
B(("p", "El caudal instantáneo se calcula en ventanas de 1 segundo. Con caudales muy bajos (menos de "
        "0.5 L/min) la lectura puede oscilar; el acumulado sigue siendo válido."))
B(("h2", "11.5 Persistencia y reinicio"))
B(("p", "Después de calibrar, reinicia la placa y verifica que los valores se mantengan. La calibración "
        "vive en NVS y no se pierde al desconectar la alimentación. Para volver a los valores de "
        "fábrica, usa el botón de recarga y guarda los valores por defecto, o llama a la API con los "
        "parámetros iniciales."))

# ---------------------------------------------------------------------------
# 12. PRUEBAS
# ---------------------------------------------------------------------------
B(("h1", "12. Plan de pruebas"))
B(("p", "El plan avanza de lo simple a lo complejo. Marca cada casilla solo cuando el resultado "
        "observado coincida con el criterio. Si algo falla, no sigas: resuélvelo con el capítulo 13."))
B(("h2", "12.1 Pruebas de banco, sin agua"))
B(("checklist", [
    "El ESP32 arranca y muestra su IP en el monitor serie.",
    "El dashboard carga desde la placa y desde la PC.",
    "Sin sensores, cada tarjeta muestra «--» sin romper la página.",
    "La placa responde a los 10 minutos sin reiniciarse.",
]))
B(("h2", "12.2 Pruebas por sensor"))
B(("tabla", {
    "headers": ["", "Sensor", "Prueba", "Resultado esperado"],
    "rows": [
        ["□", "LCD", "Encender y observar", "Cuatro páginas rotando, texto legible"],
        ["□", "LCD", "Girar el contraste", "El texto se aclara u oscurece"],
        ["□", "DS18B20", "Sostener con la mano", "La temperatura sube lentamente"],
        ["□", "DS18B20", "Agua con hielo", "La temperatura baja hacia 0 °C"],
        ["□", "HC-SR04", "Obstáculo a 30 cm", "Distancia 30 ± 1 cm"],
        ["□", "HC-SR04", "Alejar la mano", "La distancia aumenta"],
        ["□", "HC-SR04", "Sin obstáculo", "Muestra «--», no un valor absurdo"],
        ["□", "YF-S201", "Soplar por la entrada", "L/min mayor que 0 mientras hay flujo"],
        ["□", "YF-S201", "Dejar de soplar", "L/min vuelve a 0 en 2 segundos"],
        ["□", "YF-S201", "Reiniciar total", "El acumulado vuelve a 0"],
        ["□", "SEN0189", "Agua clara", "NTU bajo y claridad alta"],
        ["□", "SEN0189", "Agregar leche o tierra", "NTU sube y claridad baja"],
        ["□", "SEN0189", "Medir voltaje en el pin", "Nunca supera 3.3 V"],
        ["□", "PH-7BNC", "Agua potable", "pH entre 6.5 y 8.5 (provisional)"],
        ["□", "PH-7BNC", "Buffer 7", "pH 7.0 ± 0.1 tras calibrar"],
        ["□", "PH-7BNC", "Buffer 4", "pH 4.0 ± 0.15 tras calibrar"],
    ],
    "widths": [1.0, 2.8, 6.6, 6.6],
    "font": 8.6,
    "caption": "Pruebas individuales de cada componente",
    "align": ["center", "left", "left", "left"],
}))
B(("h2", "12.3 Integración"))
B(("checklist", [
    "Los cinco sensores conectados a la vez: la placa no se reinicia.",
    "Treinta minutos continuos sin errores de watchdog en el monitor serie.",
    "La web responde en menos de un segundo con todos los sensores activos.",
    "Computadora y celular ven los datos al mismo tiempo.",
    "Al desconectar el router, la placa levanta `Reservorio-Setup`.",
    "Al reiniciar, la calibración y el totalizador se conservan.",
]))
B(("h2", "12.4 Pruebas con agua"))
B(("checklist", [
    "Llenado real: nivel comparado con cinta métrica a 25, 50, 75 y 100 %.",
    "Entrada de agua: caudal coherente con el tiempo de llenado.",
    "Temperatura estable después de 10 minutos de inmersión.",
    "pH del agua de red dentro de 6.5 a 8.5.",
    "Turbidez antes y después de dejar reposar: debe bajar.",
    "Veinticuatro horas continuas sin lecturas congeladas ni picos raros.",
]))
B(("h2", "12.5 Criterios de aceptación"))
B(("tabla", {
    "headers": ["Magnitud", "Tolerancia aceptada", "Condición"],
    "rows": [
        ["Nivel", "±1 cm", "Con el tanque en reposo"],
        ["Volumen estimado", "±5 %", "Tanque cilíndrico y altura bien medida"],
        ["Temperatura", "±0.5 °C", "Comparado con termómetro"],
        ["pH", "±0.1 pH", "Con buffers recientes"],
        ["Turbidez", "Tendencia", "No se exige valor absoluto"],
        ["Caudal", "±5 %", "Con balde de referencia"],
    ],
    "widths": [4.2, 5.6, 7.2],
    "caption": "Tolerancias de aceptación de la fase 1",
}))

# ---------------------------------------------------------------------------
# 13. PROBLEMAS
# ---------------------------------------------------------------------------
B(("h1", "13. Solución de problemas"))
B(("tabla", {
    "headers": ["Síntoma", "Causa probable", "Solución"],
    "rows": [
        ["No aparece el puerto USB", "Cable de carga o falta el driver", "Probar un cable de datos; instalar CH340 o CP210x"],
        ["Permiso denegado en el puerto", "Usuario fuera del grupo dialout", "sudo usermod -aG dialout $USER y reentrar"],
        ["Failed to connect al subir", "Placa no está en modo descarga", "BOOT + EN, o bajar la velocidad a 115200"],
        ["Se reinicia solo", "Alimentación insuficiente o brownout", "Fuente de 5 V 2 A y GND común"],
        ["El WiFi no conecta", "Red de 5 GHz o clave incorrecta", "Usar 2.4 GHz; revisar secrets.h"],
        ["El dashboard queda en Demo", "ESP32_URL sin definir o redes distintas", "Definir ESP32_URL o abrir la web desde la placa"],
        ["Todas las tarjetas en «--»", "Firmware sin uploadfs o sin sensores", "Subir la web; revisar el monitor serie"],
        ["Nivel siempre 0", "Echo sin divisor o pines invertidos", "Revisar divisor y pines 18/19"],
        ["Nivel salta mucho", "Superficie agitada o eco débil", "Tubo guía y montaje perpendicular"],
        ["pH pegado a 0 o 14", "Entrada saturada por 5 V", "Poner el divisor y verificar PH_DIVIDER"],
        ["Turbidez siempre 0", "Falta el divisor o el pin A", "Revisar divisor y GPIO 35"],
        ["DS18B20 en -127 °C", "Sin pull-up o cables invertidos", "4.7 kΩ entre DATA y 3V3"],
        ["El caudal no cuenta", "Sin pull-up o contacto flojo", "4.7 kΩ entre señal y 3V3; ajustar dupont"],
        ["LCD en blanco", "Contraste o dirección I2C", "Girar el potenciómetro; mirar el monitor"],
        ["El total de litros no coincide", "Pulsos por litro mal ajustados", "Calibrar con un balde de 10 L"],
        ["La web no carga archivos", "Falta uploadfs", "node tools/sync-web.js y subir LittleFS"],
    ],
    "widths": [4.6, 5.0, 7.4],
    "font": 8.6,
    "caption": "Problemas frecuentes y su resolución",
}))

# ---------------------------------------------------------------------------
# 14. ORGANIZACIÓN
# ---------------------------------------------------------------------------
B(("h1", "14. Organización del proyecto y mantenimiento"))
B(("p", "El repositorio separa firmware, web, herramientas y documentación. Esta organización permite "
        "trabajar en una parte sin tocar las demás y mantiene el informe reproducible."))
B(("codigo", """Reservorio_Agua/
├── firmware/          Código C++ para el ESP32 (PlatformIO)
│   ├── include/       config.h y secrets.h
│   ├── src/           main, sensores, web, pantalla
│   └── data/          Copia de la web para LittleFS
├── web/               Dashboard estático (HTML, CSS, JS)
├── tools/             Servidor local, sincronización e informe
├── docs/              Guías, diagramas e imágenes
└── README.md          Punto de entrada"""))
B(("h2", "14.1 Documentación disponible"))
B(("tabla", {
    "headers": ["Documento", "Contenido"],
    "rows": [
        ["README.md", "Presentación, inicio rápido y estructura"],
        ["docs/README.md", "Índice de toda la documentación"],
        ["docs/guia-paso-a-paso.md", "Guía de montaje desde cero, sin soldar"],
        ["docs/cableado.md", "Detalle eléctrico, divisores y notas de montaje"],
        ["docs/calibracion.md", "Procedimientos de calibración"],
        ["docs/pruebas.md", "Plan de pruebas con casillas"],
        ["docs/roadmap.md", "Fases futuras, nube y modelo 3D"],
        ["docs/img/", "Diagramas y capturas del sistema"],
        ["Este informe", "Versión integrada y ampliada de todo lo anterior"],
    ],
    "widths": [6.4, 10.6],
    "caption": "Documentos del proyecto",
}))
B(("h2", "14.2 Convenciones"))
B(("lista", [
    "Un archivo por sensor, con su clase y su lógica de filtrado.",
    "Los pines viven en config.h; ningún otro archivo define números de pin.",
    "La calibración se guarda en NVS con el espacio de nombres `reserv`.",
    "La API usa JSON y devuelve `null` cuando una lectura no es válida.",
    "El dashboard nunca inventa datos en modo ESP32: si no hay respuesta, lo informa.",
]))
B(("h2", "14.3 Regenerar este informe"))
B(("p", "El documento se genera desde `tools/informe/` con python-docx. Las imágenes se toman de "
        "`docs/img/`. Para reconstruirlo después de un cambio:"))
B(("codigo", "./.venv/bin/python tools/informe/generar.py"))
B(("p", "Si actualizas el dashboard, vuelve a capturar las imágenes y a copiar la web a "
        "`firmware/data` con `node tools/sync-web.js`."))

# ---------------------------------------------------------------------------
# 15. ROADMAP
# ---------------------------------------------------------------------------
B(("h1", "15. Trabajo pendiente (roadmap)"))
B(("tabla", {
    "headers": ["Fase", "Contenido", "Estado"],
    "rows": [
        ["1. Sensores y web local", "Montaje, firmware, dashboard, calibración y pruebas", "Software listo; hardware pendiente"],
        ["2. Web publicada y nube", "Vercel, Supabase, histórico y acceso remoto", "Planificado"],
        ["3. Modelo digital 3D", "Representación del tanque con el nivel real", "Anotado"],
        ["4. Operación", "Alertas, OTA, caja IP65 y mantenimiento", "Futuro"],
    ],
    "widths": [4.6, 8.6, 3.8],
    "caption": "Fases del proyecto",
}))
B(("h2", "15.1 Fase 2: datos en la nube"))
B(("p", "La ruta propuesta usa Supabase para las lecturas y Vercel para el tablero. El ESP32 enviaría "
        "un POST cada 10 a 30 segundos con su token; el dashboard leería la última lectura por REST o "
        "Realtime. Es necesario resolver el contenido mixto: una página HTTPS no puede consultar el "
        "ESP32 HTTP local, por eso los datos deben salir del ESP32 hacia un servicio público."))
B(("h2", "15.2 Fase 3: modelo digital 3D"))
B(("p", "El modelo 3D del reservorio queda anotado para una fase posterior. Requiere la geometría real "
        "del tanque, la curva de volumen contra altura si no es cilíndrico y el histórico de la fase 2. "
        "Se integraría como una pestaña del dashboard, no como reemplazo. La idea es que el nivel del "
        "modelo refleje la medición real y permita ver zonas (óptimo, bajo, crítico) de un vistazo."))
B(("h2", "15.3 Mejoras de operación"))
B(("lista", [
    "Alertas por correo o Telegram cuando el nivel, el pH o el caudal salgan de rango.",
    "Actualización de firmware por OTA para no desarmar el equipo.",
    "Caja IP65 con prensaestopas y protección contra sobretensión.",
    "Gráficas de 24 horas y 7 días con datos históricos.",
    "Limpieza periódica del lente de turbidez y recalibración del pH.",
]))

# ---------------------------------------------------------------------------
# ANEXO A
# ---------------------------------------------------------------------------
B(("h1", "Anexo A. Fórmulas y criterios de cálculo"))
B(("tabla", {
    "headers": ["Magnitud", "Fórmula", "Notas"],
    "rows": [
        ["Nivel", "nivel = altura − distancia − offset", "Distancia medida por el ultrasónico"],
        ["Porcentaje", "nivel / altura × 100", "Acotado entre 0 y 100"],
        ["Volumen", "π × r² × nivel / 1000", "r y nivel en cm; resultado en litros"],
        ["Caudal", "L/min = pulsos por segundo × 60 / 450", "YF-S201: 450 pulsos por litro"],
        ["Volumen acumulado", "pulsos totales / 450", "Se guarda cada 30 segundos"],
        ["pH", "pH = 7 + (V_neutro − V) / pendiente", "Pendiente típica: 0.18 V/pH"],
        ["Turbidez", "NTU = −1120.4 V² + 5742.3 V − 4352.9", "Curva del fabricante, aproximada"],
        ["Claridad", "V / V_agua_clara × 100", "Acotada entre 0 y 100 %"],
        ["Divisor", "Vout = Vin × R2 / (R1 + R2)", "Con R1 = R2, Vout = Vin / 2"],
    ],
    "widths": [3.4, 9.0, 4.6],
    "font": 8.6,
    "caption": "Fórmulas utilizadas por el firmware",
}))
B(("h2", "A.1 Ejemplo numérico"))
B(("p", "Tanque cilíndrico de 80 cm de diámetro y 100 cm de altura. Radio = 40 cm. Volumen total = "
        "π × 40² × 100 / 1000 = **502.65 litros**. Si el sensor mide 34.7 cm desde la tapa, el nivel es "
        "100 − 34.7 = 65.3 cm, es decir 65.3 %. El volumen es π × 40² × 65.3 / 1000 = **328.2 litros**."))
B(("p", "Con un caudal de 4.14 L/min, el sensor entrega 4.14 × 450 / 60 = **31 pulsos por segundo**. "
        "En una ventana de un segundo, 31 pulsos producen exactamente 4.13 L/min."))
B(("h2", "A.2 Incertidumbre y límites"))
B(("lista", [
    "El ultrasónico tiene una zona muerta de 2 cm y pierde el eco con superficies agitadas o inclinadas.",
    "El pH depende del estado del electrodo y de la temperatura; la deriva es normal con el uso.",
    "La turbidez es una medida óptica relativa: sirve para comparar y detectar cambios, no para reemplazar un laboratorio.",
    "El caudalímetro pierde precisión con flujos muy bajos y con aire en la tubería.",
    "El volumen se calcula como cilindro perfecto; un tanque cónico o rectangular requiere otra fórmula.",
]))

# ---------------------------------------------------------------------------
# ANEXO B
# ---------------------------------------------------------------------------
B(("h1", "Anexo B. Referencia rápida"))
B(("h2", "B.1 Conexiones en una tabla"))
B(("tabla", {
    "headers": ["Sensor", "VCC", "GND", "Señal", "Extra"],
    "rows": [
        ["HC-SR04", "5 V", "GND", "TRIG 19 · ECHO 18", "Divisor ÷2 en ECHO"],
        ["YF-S201", "5 V", "GND", "23", "Pull-up 4.7 kΩ a 3V3"],
        ["DS18B20", "3V3", "GND", "4", "Pull-up 4.7 kΩ a 3V3"],
        ["SEN0189", "5 V", "GND", "35", "Divisor ÷2"],
        ["PH-7BNC", "5 V", "GND", "Po 34", "Divisor ÷2"],
        ["LCD 1602", "5 V", "GND", "SDA 21 · SCL 22", "—"],
    ],
    "widths": [3.2, 2.2, 2.2, 4.6, 4.8],
    "caption": "Referencia rápida de conexiones",
}))
B(("h2", "B.2 Comandos esenciales"))
B(("codigo", """# Compilar y subir
./tools/pio.sh run -d firmware -t upload
# Monitor serie
./tools/pio.sh device monitor -d firmware -b 115200
# Dashboard local
node tools/dev-server.js
# Web dentro del ESP32
node tools/sync-web.js
./tools/pio.sh run -d firmware -t uploadfs"""))
B(("h2", "B.3 Antes de energizar"))
B(("checklist", [
    "Ningún GPIO recibe 5 V.",
    "Todos los GND están unidos.",
    "El riel rojo tiene 5 V y el azul es tierra.",
    "Los divisores están en ECHO, AO y Po.",
    "Los pull-ups van a 3.3 V, no a 5 V.",
]))
B(("h2", "B.4 Glosario"))
B(("tabla", {
    "headers": ["Término", "Significado"],
    "rows": [
        ["ADC", "Conversor analógico-digital; transforma una tensión en un número"],
        ["ADC1", "Grupo de canales del ESP32 que funciona con WiFi activo (GPIO 32–39)"],
        ["Pull-up", "Resistencia que mantiene una señal en nivel alto cuando nadie la fuerza"],
        ["Divisor", "Dos resistencias que reducen una tensión"],
        ["NVS", "Memoria no volátil del ESP32, usada para la calibración"],
        ["LittleFS", "Sistema de archivos en la memoria flash, usado para la web"],
        ["NTU", "Unidad nefelométrica de turbidez"],
        ["mDNS", "Nombre local, por ejemplo reservorio.local"],
        ["JSON", "Formato de texto usado por la API"],
        ["OTA", "Actualización de firmware por WiFi"],
    ],
    "widths": [3.4, 13.6],
    "caption": "Glosario de términos",
}))

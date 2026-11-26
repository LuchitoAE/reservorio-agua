/**
 * Fuentes de datos de la web publicada en Vercel. Ver docs/nube.md.
 *
 * esp32: dirección del ESP32 en la red de la casa. Si quien mira está en ese WiFi (Chrome o
 * Edge, con el permiso de "acceso a la red local"), la página lo lee directo. Se activa con
 * el botón "Conectar con el ESP32 de mi casa" y el navegador lo recuerda (localStorage).
 *
 * url/key: Supabase, para ver los datos reales desde cualquier lugar.
 *
 * Estos dos valores son PÚBLICOS por diseño (van en la página): la clave publishable/anon
 * solo permite llamar a ultimo() para leer el último dato. Escribir exige el token secreto
 * del ESP32, que está solo en firmware/include/secrets.h.
 *
 * Vacíos = sin nube: la web publicada muestra la simulación.
 */
export const NUBE = {
  esp32: 'http://192.168.2.200',
  url: '',  // https://xxxxxxxx.supabase.co
  key: '',  // sb_publishable_... (o la clave anon antigua, eyJ...)
};

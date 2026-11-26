/**
 * Conexión a la nube (Supabase) para la web publicada en Vercel. Ver docs/nube.md.
 *
 * Estos dos valores son PÚBLICOS por diseño (van en la página): la clave publishable/anon
 * solo permite llamar a ultimo() para leer el último dato. Escribir exige el token secreto
 * del ESP32, que está solo en firmware/include/secrets.h.
 *
 * Vacíos = sin nube: la web publicada muestra la simulación.
 */
export const NUBE = {
  url: '',  // https://xxxxxxxx.supabase.co
  key: '',  // sb_publishable_... (o la clave anon antigua, eyJ...)
};

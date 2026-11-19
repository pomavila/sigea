/* =========================================================
   SIGEA · Utilidades de fechas
   Todas las fechas de negocio viajan como texto "AAAA-MM-DD"
   (igual que el tipo DATE de MySQL). Así evitamos el error
   clásico de las zonas horarias: un Date de JavaScript guarda
   también la hora, y al convertirlo puede "saltar" de día.
   ========================================================= */

'use strict';

const MS_POR_DIA = 24 * 60 * 60 * 1000;
const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Zona horaria del negocio (Huancayo). Se puede cambiar con la variable ZONA_HORARIA.
const ZONA_HORARIA = process.env.ZONA_HORARIA || 'America/Lima';

// "2026-11-09" -> Date a medianoche UTC (solo se usa para hacer cuentas)
function aFecha(texto) {
  const [anio, mes, dia] = texto.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia));
}

// Date -> "2026-11-09"
function aTexto(fecha) {
  return fecha.toISOString().slice(0, 10);
}

// Comprueba el formato Y que la fecha exista (rechaza 2026-02-30)
function esFechaValida(texto) {
  if (typeof texto !== 'string' || !REGEX_FECHA.test(texto)) return false;
  return aTexto(aFecha(texto)) === texto;
}

// Fecha de hoy en la zona horaria del negocio, como "AAAA-MM-DD".
// El formato regional 'en-CA' escribe justamente año-mes-día.
function hoy() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

// Fecha y hora actual en la zona del negocio, como "AAAA-MM-DD HH:MM:SS" (tipo DATETIME).
// La envía la API para que no dependa de la zona horaria del servidor MySQL
// (en la nube suele estar en UTC, 5 horas adelante de Huancayo).
function ahora() {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date()).map(p => [p.type, p.value]));
  return `${partes.year}-${partes.month}-${partes.day} ${partes.hour}:${partes.minute}:${partes.second}`;
}

function sumarDias(texto, dias) {
  return aTexto(new Date(aFecha(texto).getTime() + dias * MS_POR_DIA));
}

// Suma meses como lo hace MySQL (DATE_ADD ... INTERVAL n MONTH):
// si el día no existe en el mes destino, usa el último día de ese mes.
// Ejemplo: 31 de enero + 1 mes = 28 de febrero.
function sumarMeses(texto, meses) {
  const [anio, mes, dia] = texto.split('-').map(Number);
  const primerDia = new Date(Date.UTC(anio, mes - 1 + meses, 1));
  const ultimoDiaDelMes = new Date(
    Date.UTC(primerDia.getUTCFullYear(), primerDia.getUTCMonth() + 1, 0)
  ).getUTCDate();
  primerDia.setUTCDate(Math.min(dia, ultimoDiaDelMes));
  return aTexto(primerDia);
}

// Días que faltan desde "desde" hasta "hasta" (negativo si "hasta" ya pasó)
function diasEntre(desde, hasta) {
  return Math.round((aFecha(hasta) - aFecha(desde)) / MS_POR_DIA);
}

// Meses COMPLETOS entre dos fechas (igual que TIMESTAMPDIFF(MONTH, desde, hasta) de MySQL)
function mesesCompletosEntre(desde, hasta) {
  const a = aFecha(desde);
  const b = aFecha(hasta);
  let meses = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) meses -= 1;
  return meses;
}

module.exports = {
  esFechaValida,
  hoy,
  ahora,
  sumarDias,
  sumarMeses,
  diasEntre,
  mesesCompletosEntre
};

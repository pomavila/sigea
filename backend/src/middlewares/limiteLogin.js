/* =========================================================
   SIGEA · Límite de intentos de inicio de sesión
   Evita que alguien pruebe miles de contraseñas: después de 5
   intentos fallidos seguidos (misma computadora y mismo usuario)
   se bloquea el ingreso por 15 minutos.

   Los intentos se guardan en memoria (un Map). Es suficiente
   para un solo servidor; al reiniciarlo, los contadores vuelven a cero.
   ========================================================= */

'use strict';

const { ErrorApi } = require('../utils/errores');

const MAX_INTENTOS = 5;
const BLOQUEO_MS = 15 * 60 * 1000;

const intentos = new Map(); // clave -> { fallos, bloqueadoHasta }

function clave(req) {
  const usuario = String(req.body?.usuario || '').trim().toLowerCase();
  return `${req.ip}|${usuario}`;
}

function revisarBloqueo(req, res, next) {
  const registro = intentos.get(clave(req));
  if (registro && registro.bloqueadoHasta > Date.now()) {
    const minutos = Math.ceil((registro.bloqueadoHasta - Date.now()) / 60000);
    throw new ErrorApi(429, `Demasiados intentos fallidos. Intente de nuevo en ${minutos} minuto(s).`);
  }
  next();
}

function registrarFallo(req) {
  const k = clave(req);
  const registro = intentos.get(k) || { fallos: 0, bloqueadoHasta: 0 };
  registro.fallos += 1;
  if (registro.fallos >= MAX_INTENTOS) {
    registro.bloqueadoHasta = Date.now() + BLOQUEO_MS;
    registro.fallos = 0;
  }
  intentos.set(k, registro);
}

function registrarExito(req) {
  intentos.delete(clave(req));
}

// Limpieza periódica para que el Map no crezca sin control.
// unref(): este temporizador no impide que Node termine.
setInterval(() => {
  const ahora = Date.now();
  for (const [k, registro] of intentos) {
    if (registro.bloqueadoHasta < ahora && registro.fallos === 0) intentos.delete(k);
  }
}, BLOQUEO_MS).unref();

module.exports = { revisarBloqueo, registrarFallo, registrarExito, MAX_INTENTOS };

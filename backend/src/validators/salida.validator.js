/* =========================================================
   SIGEA · Validaciones del control de salida (HU-03)
   ========================================================= */

'use strict';

const { lanzarSiHayErrores } = require('../utils/errores');
const { esFechaValida, hoy } = require('../utils/fechas');

const REGEX_PLACA = /^[A-Za-z0-9 -]{3,15}$/;

// ?placa=  o  { placa }
function validarPlaca(valor) {
  const placa = typeof valor === 'string' ? valor.trim() : '';
  const errores = {};
  if (!placa) errores.placa = 'Ingrese la placa del vehículo.';
  else if (!REGEX_PLACA.test(placa)) errores.placa = 'La placa solo admite letras, números y guion (3 a 15 caracteres).';
  lanzarSiHayErrores(errores);
  return placa.toUpperCase();
}

// ?fecha=AAAA-MM-DD (si no se envía, hoy)
function validarFecha(valor) {
  if (valor === undefined || valor === '') return hoy();
  const errores = {};
  if (!esFechaValida(valor)) errores.fecha = 'La fecha debe tener el formato AAAA-MM-DD.';
  lanzarSiHayErrores(errores);
  return valor;
}

module.exports = { validarPlaca, validarFecha };

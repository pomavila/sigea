/* =========================================================
   SIGEA · Validaciones de pagos (HU-02)
   ========================================================= */

'use strict';

const { lanzarSiHayErrores } = require('../utils/errores');
const { MAX_MESES_POR_PAGO } = require('../services/reglas');

const MEDIOS_PAGO = ['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA'];
const REGEX_OPERACION = /^[A-Za-z0-9-]{4,30}$/;

function texto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

// POST /api/pagos  →  { id_contrato, meses, monto, medio_pago, nro_operacion }
function validarPago(cuerpo) {
  const errores = {};
  const datos = cuerpo && typeof cuerpo === 'object' ? cuerpo : {};

  const limpio = {
    id_contrato: Number(datos.id_contrato),
    meses: Number(datos.meses),
    monto: Number(datos.monto),
    medio_pago: texto(datos.medio_pago).toUpperCase(),
    nro_operacion: texto(String(datos.nro_operacion ?? '')) || null
  };

  if (!Number.isInteger(limpio.id_contrato) || limpio.id_contrato < 1) {
    errores.id_contrato = 'Seleccione el contrato que se va a pagar.';
  }

  if (!Number.isInteger(limpio.meses) || limpio.meses < 1 || limpio.meses > MAX_MESES_POR_PAGO) {
    errores.meses = `Los meses a pagar deben estar entre 1 y ${MAX_MESES_POR_PAGO}.`;
  }

  if (datos.monto === '' || datos.monto === null || datos.monto === undefined || Number.isNaN(limpio.monto)) {
    errores.monto = 'El monto es obligatorio.';
  } else if (limpio.monto <= 0) {
    errores.monto = 'El monto debe ser mayor a 0.';
  }

  if (!MEDIOS_PAGO.includes(limpio.medio_pago)) {
    errores.medio_pago = 'Seleccione el medio de pago.';
  }

  // En efectivo no existe número de operación
  if (limpio.medio_pago === 'EFECTIVO') {
    limpio.nro_operacion = null;
  } else if (limpio.nro_operacion && !REGEX_OPERACION.test(limpio.nro_operacion)) {
    errores.nro_operacion = 'El número de operación admite letras, números y guion (4 a 30 caracteres).';
  }

  lanzarSiHayErrores(errores);
  return limpio;
}

// POST /api/pagos/:id/anular  →  { motivo }
function validarAnulacion(cuerpo) {
  const motivo = texto(cuerpo?.motivo);
  const errores = {};
  if (motivo.length < 5) errores.motivo = 'Indique el motivo de la anulación (mínimo 5 caracteres).';
  else if (motivo.length > 200) errores.motivo = 'El motivo admite máximo 200 caracteres.';
  lanzarSiHayErrores(errores);
  return motivo;
}

module.exports = { validarPago, validarAnulacion, MEDIOS_PAGO };

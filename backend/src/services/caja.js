/* =========================================================
   SIGEA · Cuadre del día (Sprint 2 · HU-04 · T19)

   Suma lo cobrado en un día por cada medio de pago, para que la
   caja cuadre el efectivo y los pagos digitales con Finanzas.
   Los pagos anulados no suman: se muestran aparte.
   ========================================================= */

'use strict';

const pagoModel = require('../models/pago.model');
const { aCentimos } = require('./reglas');
const { hoy } = require('../utils/fechas');

const MEDIOS = ['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA'];

/**
 * Regla pura (sin base de datos): agrupa los pagos por medio.
 * Se suma en céntimos para no arrastrar errores de redondeo.
 */
function resumirPagos(pagos) {
  const vigentes = pagos.filter(p => p.estado === 'REGISTRADO');
  const anulados = pagos.filter(p => p.estado === 'ANULADO');
  const sumar = lista => lista.reduce((s, p) => s + aCentimos(p.monto), 0) / 100;

  return {
    cantidad: vigentes.length,
    total: sumar(vigentes),
    por_medio: MEDIOS.map(medio => {
      const delMedio = vigentes.filter(p => p.medio_pago === medio);
      return { medio, cantidad: delMedio.length, total: sumar(delMedio) };
    }),
    anulados: { cantidad: anulados.length, total: sumar(anulados) }
  };
}

async function cuadreDelDia(fecha = hoy()) {
  const pagos = await pagoModel.pagosDelDia(fecha);
  return { fecha, ...resumirPagos(pagos), pagos };
}

module.exports = { MEDIOS, resumirPagos, cuadreDelDia };

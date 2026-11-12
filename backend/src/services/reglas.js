/* =========================================================
   SIGEA · Reglas de negocio de cobranza (RN-01 y RN-02)
   Son funciones PURAS: reciben datos y devuelven un resultado,
   sin tocar la base de datos. Por eso se pueden probar solas
   (ver tests/reglas.test.js).

   Concepto clave: la COBERTURA es la fecha hasta la que el
   abonado tiene pagado su espacio.
     - Con pagos:  el mayor periodo_hasta de sus pagos vigentes.
     - Sin pagos:  el día anterior al inicio del contrato
                   (todavía no ha cubierto ningún día).
   ========================================================= */

'use strict';

const { sumarDias, sumarMeses, diasEntre, mesesCompletosEntre } = require('../utils/fechas');
const { ErrorApi } = require('../utils/errores');

const DIAS_AVISO = 5;            // RN-01: "por vencer" si faltan de 0 a 5 días
const MAX_MESES_POR_PAGO = 12;   // un pago cubre como máximo 12 meses

const ESTADOS = Object.freeze({
  AL_DIA: 'AL_DIA',
  POR_VENCER: 'POR_VENCER',
  VENCIDO: 'VENCIDO'
});

// La tarifa llega de MySQL como texto ("200.00"). Se trabaja en céntimos
// (enteros) para evitar los errores de redondeo de los decimales.
function aCentimos(monto) {
  return Math.round(Number(monto) * 100);
}

function calcularCobertura(contrato, pagadoHasta) {
  return pagadoHasta || sumarDias(contrato.fecha_inicio, -1);
}

/**
 * RN-01 · Estado del abonado según su cobertura.
 *   AL_DIA      vence en más de 5 días
 *   POR_VENCER  vence en 0 a 5 días
 *   VENCIDO     la fecha ya pasó
 */
function calcularEstado(cobertura, hoy) {
  const dias = diasEntre(hoy, cobertura);
  let estado = ESTADOS.AL_DIA;
  if (dias < 0) estado = ESTADOS.VENCIDO;
  else if (dias <= DIAS_AVISO) estado = ESTADOS.POR_VENCER;
  return { estado, dias_para_vencer: dias };
}

/**
 * RN-02 · Saldo pendiente = meses adeudados × tarifa mensual.
 * Se cobra por adelantado: apenas empieza un mes sin pagar, ese mes ya se debe.
 * No se cobra más allá de la fecha de fin del contrato.
 */
function calcularDeuda(contrato, cobertura, hoy) {
  const inicioDeuda = sumarDias(cobertura, 1);          // primer día sin cubrir
  const limite = hoy < contrato.fecha_fin ? hoy : contrato.fecha_fin;

  let meses = 0;
  if (inicioDeuda <= limite) {
    meses = mesesCompletosEntre(inicioDeuda, limite) + 1; // +1: el mes en curso ya se debe
  }
  return {
    meses_adeudados: meses,
    saldo_pendiente: (aCentimos(contrato.tarifa_mensual) * meses) / 100
  };
}

/**
 * Periodo que cubre un pago de N meses. Siempre continúa donde terminó
 * la cobertura anterior: así no quedan días sin cobrar ni días cobrados dos veces.
 */
function calcularPeriodoPago(contrato, cobertura, meses) {
  const periodoDesde = sumarDias(cobertura, 1);
  if (periodoDesde > contrato.fecha_fin) {
    throw new ErrorApi(409, 'El contrato ya está pagado hasta su fecha de fin.');
  }
  let periodoHasta = sumarDias(sumarMeses(periodoDesde, meses), -1);
  if (periodoHasta > contrato.fecha_fin) {
    // Solo se acepta si el último mes queda recortado por el fin del contrato
    const inicioUltimoMes = sumarMeses(periodoDesde, meses - 1);
    if (inicioUltimoMes > contrato.fecha_fin) {
      throw new ErrorApi(400, 'Los meses a pagar superan la fecha de fin del contrato.', {
        meses: 'Los meses a pagar superan la fecha de fin del contrato.'
      });
    }
    periodoHasta = contrato.fecha_fin;
  }
  return { periodo_desde: periodoDesde, periodo_hasta: periodoHasta };
}

function montoEsperado(contrato, meses) {
  return (aCentimos(contrato.tarifa_mensual) * meses) / 100;
}

/**
 * Junta todo lo anterior para un contrato.
 * @param {object} contrato     { tarifa_mensual, fecha_inicio, fecha_fin }
 * @param {string|null} pagadoHasta  MAX(periodo_hasta) de sus pagos vigentes
 * @param {string} hoy          "AAAA-MM-DD"
 */
function evaluarContrato(contrato, pagadoHasta, hoy) {
  const cobertura = calcularCobertura(contrato, pagadoHasta);
  const proximoDesde = sumarDias(cobertura, 1);
  return {
    pagado_hasta: pagadoHasta || null,
    ...calcularEstado(cobertura, hoy),
    ...calcularDeuda(contrato, cobertura, hoy),
    // Desde qué fecha empezaría el siguiente pago (null si el contrato ya está pagado completo)
    proximo_periodo_desde: proximoDesde <= contrato.fecha_fin ? proximoDesde : null,
    contrato_finalizado: contrato.fecha_fin < hoy
  };
}

// De varios estados devuelve el más grave (un abonado con dos contratos)
function peorEstado(estados) {
  if (estados.includes(ESTADOS.VENCIDO)) return ESTADOS.VENCIDO;
  if (estados.includes(ESTADOS.POR_VENCER)) return ESTADOS.POR_VENCER;
  return ESTADOS.AL_DIA;
}

module.exports = {
  DIAS_AVISO,
  MAX_MESES_POR_PAGO,
  ESTADOS,
  aCentimos,
  calcularCobertura,
  calcularEstado,
  calcularDeuda,
  calcularPeriodoPago,
  montoEsperado,
  evaluarContrato,
  peorEstado
};

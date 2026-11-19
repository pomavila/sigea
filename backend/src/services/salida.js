/* =========================================================
   SIGEA · Servicio de control de salida (HU-03 · RN-07)

   RN-07: al consultar una placa en la salida, si el abonado tiene
   saldo pendiente (RN-02) o su estado es VENCIDO (RN-01), el
   sistema muestra una alerta roja con el monto y la registra.

   Resultados posibles:
     CON_DEUDA   abonado con deuda       -> alerta roja, cobrar antes de salir
     AL_DIA      abonado sin deuda       -> salida permitida (verde)
     NO_ABONADO  la placa no tiene contrato vigente -> cliente por hora
   ========================================================= */

'use strict';

const abonadoModel = require('../models/abonado.model');
const alertaModel = require('../models/alerta.model');
const { aResumen } = require('./cobranza');
const reglas = require('./reglas');
const { hoy, ahora } = require('../utils/fechas');

const RESULTADOS = Object.freeze({
  CON_DEUDA: 'CON_DEUDA',
  AL_DIA: 'AL_DIA',
  NO_ABONADO: 'NO_ABONADO'
});

// "4521-mt " -> "4521MT" (sin guiones ni espacios, en mayúsculas)
function normalizarPlaca(placa) {
  return String(placa || '').toUpperCase().replace(/[\s-]/g, '');
}

/**
 * Regla RN-07, sin tocar la base: recibe los contratos ya evaluados
 * (con estado y saldo_pendiente) y decide el resultado.
 */
function decidirResultado(contratos) {
  if (contratos.length === 0) return RESULTADOS.NO_ABONADO;
  const conDeuda = contratos.some(c => c.saldo_pendiente > 0 || c.estado === reglas.ESTADOS.VENCIDO);
  return conDeuda ? RESULTADOS.CON_DEUDA : RESULTADOS.AL_DIA;
}

// Consulta la placa y arma la respuesta (no guarda nada)
async function verificar(placaEscrita) {
  const placa = String(placaEscrita).trim().toUpperCase();
  const fechaHoy = hoy();
  const filas = await abonadoModel.contratosPorPlaca(normalizarPlaca(placa));
  const contratos = filas.map(fila => aResumen(fila, fechaHoy));
  const resultado = decidirResultado(contratos);

  if (resultado === RESULTADOS.NO_ABONADO) {
    return {
      placa,
      resultado,
      mensaje: 'Cliente por hora: la placa no tiene un contrato de abonado vigente.'
    };
  }

  const primero = contratos[0];
  const saldo = contratos.reduce((suma, c) => suma + reglas.aCentimos(c.saldo_pendiente), 0) / 100;
  const meses = contratos.reduce((suma, c) => suma + c.meses_adeudados, 0);
  return {
    placa: primero.vehiculo.placa_codigo,
    resultado,
    mensaje: resultado === RESULTADOS.CON_DEUDA
      ? 'Abonado con deuda: cobrar antes de permitir la salida.'
      : 'Salida permitida: el abonado está al día.',
    abonado: {
      id_abonado: primero.id_abonado,
      nombres: primero.nombres,
      apellidos: primero.apellidos,
      dni: primero.dni,
      celular: primero.celular
    },
    vehiculo: primero.vehiculo,
    espacio: primero.espacio,
    id_contrato: primero.id_contrato,
    estado: reglas.peorEstado(contratos.map(c => c.estado)),
    dias_para_vencer: primero.dias_para_vencer,
    pagado_hasta: primero.pagado_hasta,
    meses_adeudados: meses,
    saldo_pendiente: saldo
  };
}

// Consulta la placa Y deja registrada la alerta con fecha, hora y usuario
async function registrarSalida(placaEscrita, idUsuario) {
  const consulta = await verificar(placaEscrita);
  const fechaHora = ahora();
  const idAlerta = await alertaModel.registrar({
    placa: consulta.placa,
    id_contrato: consulta.id_contrato || null,
    saldo_detectado: consulta.saldo_pendiente || 0,
    resultado: consulta.resultado,
    fecha_hora: fechaHora,
    id_usuario: idUsuario
  });
  return { id_alerta: idAlerta, fecha_hora: fechaHora, ...consulta };
}

// Historial de un día con los totales por resultado
async function alertasDelDia(fecha = hoy()) {
  const alertas = await alertaModel.listarPorFecha(fecha);
  const contar = r => alertas.filter(a => a.resultado === r).length;
  return {
    fecha,
    total: alertas.length,
    con_deuda: contar(RESULTADOS.CON_DEUDA),
    al_dia: contar(RESULTADOS.AL_DIA),
    no_abonado: contar(RESULTADOS.NO_ABONADO),
    alertas
  };
}

module.exports = { RESULTADOS, normalizarPlaca, decidirResultado, verificar, registrarSalida, alertasDelDia };

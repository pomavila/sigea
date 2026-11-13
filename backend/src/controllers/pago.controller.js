/* =========================================================
   SIGEA · Controlador de pagos (HU-02 · T09)
   ========================================================= */

'use strict';

const pagoModel = require('../models/pago.model');
const cobranza = require('../services/cobranza');
const { validarPago, validarAnulacion } = require('../validators/pago.validator');
const { leerId } = require('../utils/errores');

// POST /api/pagos  →  registra un pago y devuelve cómo quedó el abonado
async function registrar(req, res) {
  const datos = validarPago(req.body);
  const pago = await pagoModel.registrar({ ...datos, id_usuario: req.usuario.id_usuario });
  res.status(201).json({
    pago,
    abonado: await cobranza.detalleAbonado(pago.id_abonado) // estado y saldo ya actualizados
  });
}

// POST /api/pagos/:id/anular  →  solo GERENCIA (RN-05)
async function anular(req, res) {
  const idPago = leerId(req.params.id);
  const motivo = validarAnulacion(req.body);
  const resultado = await pagoModel.anular({
    id_pago: idPago,
    id_usuario: req.usuario.id_usuario,
    motivo
  });
  res.json({
    mensaje: 'El pago fue anulado.',
    abonado: await cobranza.detalleAbonado(resultado.id_abonado)
  });
}

// GET /api/abonados/:id/pagos  →  historial, del más reciente al más antiguo
async function historial(req, res) {
  const idAbonado = leerId(req.params.id);
  const abonado = await cobranza.detalleAbonado(idAbonado); // lanza 404 si no existe
  res.json({
    abonado,
    pagos: await pagoModel.historialDeAbonado(idAbonado)
  });
}

// GET /api/abonados/:id/saldo  →  RN-02
async function saldo(req, res) {
  const detalle = await cobranza.detalleAbonado(leerId(req.params.id));
  res.json({
    id_abonado: detalle.id_abonado,
    estado: detalle.estado,
    meses_adeudados: detalle.meses_adeudados,
    saldo_pendiente: detalle.saldo_pendiente,
    contratos: detalle.contratos.map(c => ({
      id_contrato: c.id_contrato,
      espacio: c.espacio.codigo,
      tarifa_mensual: c.tarifa_mensual,
      pagado_hasta: c.pagado_hasta,
      meses_adeudados: c.meses_adeudados,
      saldo_pendiente: c.saldo_pendiente
    }))
  });
}

module.exports = { registrar, anular, historial, saldo };

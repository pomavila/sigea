/* =========================================================
   SIGEA · Controlador del control de salida (HU-03 · T14)
   ========================================================= */

'use strict';

const salida = require('../services/salida');
const { validarPlaca, validarFecha } = require('../validators/salida.validator');

// GET /api/salida/verificar?placa=4521-MT  →  solo consulta, no registra nada
async function verificar(req, res) {
  res.json(await salida.verificar(validarPlaca(req.query.placa)));
}

// POST /api/salida  { placa }  →  consulta y registra la alerta con fecha, hora y usuario
async function registrar(req, res) {
  const placa = validarPlaca(req.body?.placa);
  res.status(201).json(await salida.registrarSalida(placa, req.usuario.id_usuario));
}

// GET /api/alertas?fecha=2026-11-19  →  historial de alertas del día
async function alertas(req, res) {
  res.json(await salida.alertasDelDia(validarFecha(req.query.fecha)));
}

module.exports = { verificar, registrar, alertas };

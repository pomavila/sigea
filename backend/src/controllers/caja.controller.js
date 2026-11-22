/* =========================================================
   SIGEA · Controlador de caja (Sprint 2 · HU-04 · T19)
   ========================================================= */

'use strict';

const caja = require('../services/caja');
const { validarFecha } = require('../validators/salida.validator');

// GET /api/caja/cuadre?fecha=2026-11-20  →  total cobrado en el día por medio de pago
async function cuadre(req, res) {
  res.json(await caja.cuadreDelDia(validarFecha(req.query.fecha)));
}

module.exports = { cuadre };

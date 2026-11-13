/* =========================================================
   SIGEA · Controlador de abonados (HU-01 · T04 y T06)
   ========================================================= */

'use strict';

const abonadoModel = require('../models/abonado.model');
const espacioModel = require('../models/espacio.model');
const cobranza = require('../services/cobranza');
const { ESTADOS } = require('../services/reglas');
const { validarRegistro, validarEdicion } = require('../validators/abonado.validator');
const { ErrorApi, leerId } = require('../utils/errores');

const TIPOS_ESPACIO = ['TECHADO', 'EXTERIOR', 'ALMACEN'];
const ESTADOS_ESPACIO = ['LIBRE', 'OCUPADO'];

// Lee un filtro opcional de la URL y comprueba que sea uno de los valores permitidos
function leerFiltro(valor, permitidos, nombre) {
  if (valor === undefined || valor === '') return null;
  const limpio = String(valor).toUpperCase();
  if (!permitidos.includes(limpio)) {
    throw new ErrorApi(400, `El filtro "${nombre}" no es válido.`);
  }
  return limpio;
}

// GET /api/abonados?buscar=texto&estado=VENCIDO
async function listar(req, res) {
  const buscar = String(req.query.buscar || '').trim().slice(0, 60);
  const estado = leerFiltro(req.query.estado, Object.values(ESTADOS), 'estado');
  res.json(await cobranza.listarAbonados({ buscar, estado }));
}

// GET /api/abonados/:id
async function obtener(req, res) {
  res.json(await cobranza.detalleAbonado(leerId(req.params.id)));
}

// POST /api/abonados  →  abonado + vehículo + contrato en una transacción
async function crear(req, res) {
  const datos = validarRegistro(req.body);
  const { id_abonado } = await abonadoModel.crearConContrato(datos);
  // 201 Created: se creó un recurso nuevo. Se devuelve tal como quedó guardado.
  res.status(201).json(await cobranza.detalleAbonado(id_abonado));
}

// PUT /api/abonados/:id  →  edita los datos personales
async function actualizar(req, res) {
  const idAbonado = leerId(req.params.id);
  const datos = validarEdicion(req.body);
  const actualizado = await abonadoModel.actualizar(idAbonado, datos);
  if (!actualizado && !(await abonadoModel.buscarPorId(idAbonado))) {
    throw new ErrorApi(404, 'El abonado no existe.');
  }
  res.json(await cobranza.detalleAbonado(idAbonado));
}

// GET /api/abonados/:id/estado  →  RN-01
async function estado(req, res) {
  const detalle = await cobranza.detalleAbonado(leerId(req.params.id));
  res.json({
    id_abonado: detalle.id_abonado,
    estado: detalle.estado,
    contratos: detalle.contratos.map(c => ({
      id_contrato: c.id_contrato,
      espacio: c.espacio.codigo,
      estado: c.estado,
      pagado_hasta: c.pagado_hasta,
      dias_para_vencer: c.dias_para_vencer
    }))
  });
}

// GET /api/espacios?tipo=TECHADO&estado=LIBRE
async function listarEspacios(req, res) {
  const tipo = leerFiltro(req.query.tipo, TIPOS_ESPACIO, 'tipo');
  const estadoEspacio = leerFiltro(req.query.estado, ESTADOS_ESPACIO, 'estado');
  res.json(await espacioModel.listar({ tipo, estado: estadoEspacio }));
}

// GET /api/resumen  →  números del panel principal
async function resumen(req, res) {
  const [cobros, espacios] = await Promise.all([
    cobranza.resumenGeneral(),
    espacioModel.contarPorEstado()
  ]);
  res.json({ ...cobros, espacios });
}

module.exports = { listar, obtener, crear, actualizar, estado, listarEspacios, resumen };

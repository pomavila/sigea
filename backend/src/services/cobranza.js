/* =========================================================
   SIGEA · Servicio de cobranza
   Une los datos de la base (modelos) con las reglas de negocio
   (reglas.js) y arma los objetos que devuelve la API.
   ========================================================= */

'use strict';

const abonadoModel = require('../models/abonado.model');
const reglas = require('./reglas');
const { hoy } = require('../utils/fechas');
const { ErrorApi } = require('../utils/errores');

// Convierte una fila de la consulta de contratos en el objeto que recibe el frontend
function aResumen(fila, fechaHoy) {
  return {
    id_abonado: fila.id_abonado,
    nombres: fila.nombres,
    apellidos: fila.apellidos,
    dni: fila.dni,
    direccion: fila.direccion,
    celular: fila.celular,
    id_contrato: fila.id_contrato,
    tarifa_mensual: Number(fila.tarifa_mensual),
    fecha_inicio: fila.fecha_inicio,
    fecha_fin: fila.fecha_fin,
    vehiculo: {
      id_vehiculo: fila.id_vehiculo,
      tipo: fila.tipo_vehiculo,
      placa_codigo: fila.placa_codigo,
      descripcion: fila.descripcion_vehiculo
    },
    espacio: {
      id_espacio: fila.id_espacio,
      codigo: fila.codigo_espacio,
      tipo: fila.tipo_espacio
    },
    fecha_ultimo_pago: fila.fecha_ultimo_pago || null,
    // RN-01 y RN-02: estado, días para vencer, meses adeudados y saldo
    ...reglas.evaluarContrato(fila, fila.pagado_hasta, fechaHoy)
  };
}

async function listarAbonados({ buscar = '', estado = null } = {}) {
  const fechaHoy = hoy();
  const filas = await abonadoModel.listarContratos({ buscar });
  const lista = filas.map(fila => aResumen(fila, fechaHoy));
  return estado ? lista.filter(item => item.estado === estado) : lista;
}

// Datos del abonado + todos sus contratos vigentes ya evaluados. Lanza 404 si no existe.
async function detalleAbonado(idAbonado) {
  const abonado = await abonadoModel.buscarPorId(idAbonado);
  if (!abonado) {
    throw new ErrorApi(404, 'El abonado no existe.');
  }
  const fechaHoy = hoy();
  const filas = await abonadoModel.contratosDeAbonado(idAbonado);
  const contratos = filas.map(fila => {
    // En el detalle los datos personales van una sola vez, fuera de cada contrato
    const { id_abonado, nombres, apellidos, dni, direccion, celular, ...contrato } = aResumen(fila, fechaHoy);
    return contrato;
  });

  return {
    ...abonado,
    // Totales del abonado (suma de sus contratos)
    estado: contratos.length ? reglas.peorEstado(contratos.map(c => c.estado)) : null,
    meses_adeudados: contratos.reduce((suma, c) => suma + c.meses_adeudados, 0),
    saldo_pendiente: contratos.reduce((suma, c) => suma + reglas.aCentimos(c.saldo_pendiente), 0) / 100,
    contratos
  };
}

// Números para el panel principal
async function resumenGeneral() {
  const lista = await listarAbonados();
  const contar = estado => lista.filter(item => item.estado === estado).length;
  return {
    contratos_vigentes: lista.length,
    al_dia: contar(reglas.ESTADOS.AL_DIA),
    por_vencer: contar(reglas.ESTADOS.POR_VENCER),
    vencidos: contar(reglas.ESTADOS.VENCIDO),
    saldo_total: lista.reduce((suma, item) => suma + reglas.aCentimos(item.saldo_pendiente), 0) / 100
  };
}

module.exports = { listarAbonados, detalleAbonado, resumenGeneral };

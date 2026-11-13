/* =========================================================
   SIGEA · Modelo de pagos (tabla pago)
   HU-02 · Tarea T09 (registrar pago, historial y saldo)
   ========================================================= */

'use strict';

const { pool, enTransaccion } = require('../config/db');
const { ErrorApi } = require('../utils/errores');
const reglas = require('../services/reglas');

// Fecha hasta la que está pagado un contrato (null si no tiene pagos vigentes)
async function pagadoHasta(conexion, idContrato) {
  const [filas] = await conexion.execute(
    `SELECT MAX(periodo_hasta) AS pagado_hasta
       FROM pago
      WHERE id_contrato = ? AND estado = 'REGISTRADO'`,
    [idContrato]
  );
  return filas[0].pagado_hasta;
}

/**
 * Registra un pago de N meses para un contrato.
 * El periodo (desde/hasta) lo calcula el servidor: continúa justo donde
 * terminó el último pago, así nunca quedan huecos ni periodos duplicados.
 */
async function registrar({ id_contrato, meses, monto, medio_pago, nro_operacion, id_usuario }) {
  try {
    return await enTransaccion(async conexion => {
      // FOR UPDATE: si dos cajas cobran al mismo contrato a la vez, la segunda
      // espera a que termine la primera y calcula su periodo con el dato nuevo.
      const [contratos] = await conexion.execute(
        `SELECT id_contrato, id_abonado, tarifa_mensual, fecha_inicio, fecha_fin, estado
           FROM contrato
          WHERE id_contrato = ?
            FOR UPDATE`,
        [id_contrato]
      );
      const contrato = contratos[0];
      if (!contrato) {
        throw new ErrorApi(404, 'El contrato no existe.');
      }
      if (contrato.estado !== 'VIGENTE') {
        throw new ErrorApi(409, 'Solo se pueden registrar pagos de contratos vigentes.');
      }

      const cobertura = reglas.calcularCobertura(contrato, await pagadoHasta(conexion, id_contrato));
      const periodo = reglas.calcularPeriodoPago(contrato, cobertura, meses);

      // El monto debe corresponder a los meses que se pagan
      const esperado = reglas.montoEsperado(contrato, meses);
      if (reglas.aCentimos(monto) !== reglas.aCentimos(esperado)) {
        const texto = `El monto debe ser S/ ${esperado.toFixed(2)} ` +
          `(${meses} mes(es) × S/ ${Number(contrato.tarifa_mensual).toFixed(2)}).`;
        throw new ErrorApi(400, texto, { monto: texto });
      }

      const [resultado] = await conexion.execute(
        `INSERT INTO pago (id_contrato, monto, periodo_desde, periodo_hasta, medio_pago, nro_operacion, id_usuario)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id_contrato, monto, periodo.periodo_desde, periodo.periodo_hasta,
         medio_pago, nro_operacion, id_usuario]
      );

      return {
        id_pago: resultado.insertId,
        id_abonado: contrato.id_abonado,
        id_contrato,
        monto,
        ...periodo,
        medio_pago,
        nro_operacion
      };
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY' && (error.sqlMessage || '').includes('uq_pago_nro_operacion')) {
      throw new ErrorApi(409, 'Ese número de operación ya fue registrado en otro pago.', {
        nro_operacion: 'Ese número de operación ya fue registrado en otro pago.'
      });
    }
    throw error;
  }
}

// Historial de pagos de un abonado, del más reciente al más antiguo (T11)
async function historialDeAbonado(idAbonado) {
  const [filas] = await pool.execute(
    `SELECT p.id_pago, p.id_contrato, p.fecha_pago, p.monto, p.periodo_desde, p.periodo_hasta,
            p.medio_pago, p.nro_operacion, p.estado,
            p.fecha_anulacion, p.motivo_anulacion,
            u.nombre  AS registrado_por,
            ua.nombre AS anulado_por,
            v.placa_codigo, e.codigo AS codigo_espacio
       FROM pago p
       JOIN contrato c ON c.id_contrato = p.id_contrato
       JOIN vehiculo v ON v.id_vehiculo = c.id_vehiculo
       JOIN espacio  e ON e.id_espacio  = c.id_espacio
       JOIN usuario  u ON u.id_usuario  = p.id_usuario
       LEFT JOIN usuario ua ON ua.id_usuario = p.anulado_por
      WHERE c.id_abonado = ?
      ORDER BY p.fecha_pago DESC, p.id_pago DESC`,
    [idAbonado]
  );
  return filas.map(fila => ({ ...fila, monto: Number(fila.monto) }));
}

/**
 * Anula un pago (RN-05: solo GERENCIA; el permiso se revisa en la ruta).
 * El pago NO se borra: cambia a estado ANULADO y se guarda quién, cuándo y por qué.
 * Solo se puede anular el último pago del contrato, para no dejar un
 * hueco en medio de los periodos pagados.
 */
async function anular({ id_pago, id_usuario, motivo }) {
  return enTransaccion(async conexion => {
    const [pagos] = await conexion.execute(
      `SELECT p.id_pago, p.id_contrato, p.estado, p.periodo_hasta, c.id_abonado
         FROM pago p
         JOIN contrato c ON c.id_contrato = p.id_contrato
        WHERE p.id_pago = ?
          FOR UPDATE`,
      [id_pago]
    );
    const pago = pagos[0];
    if (!pago) {
      throw new ErrorApi(404, 'El pago no existe.');
    }
    if (pago.estado === 'ANULADO') {
      throw new ErrorApi(409, 'El pago ya estaba anulado.');
    }
    if (pago.periodo_hasta !== await pagadoHasta(conexion, pago.id_contrato)) {
      throw new ErrorApi(409, 'Solo se puede anular el último pago del contrato.');
    }

    await conexion.execute(
      `UPDATE pago
          SET estado = 'ANULADO', anulado_por = ?, fecha_anulacion = NOW(), motivo_anulacion = ?
        WHERE id_pago = ?`,
      [id_usuario, motivo, id_pago]
    );
    return { id_pago, id_abonado: pago.id_abonado, id_contrato: pago.id_contrato };
  });
}

module.exports = { registrar, historialDeAbonado, anular };

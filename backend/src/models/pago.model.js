/* =========================================================
   SIGEA · Modelo de pagos (tabla pago)
   HU-02 · Tarea T09 (registrar pago, historial y saldo)
   ========================================================= */

'use strict';

const { pool, enTransaccion } = require('../config/db');
const { ErrorApi } = require('../utils/errores');
const reglas = require('../services/reglas');
const { ahora } = require('../utils/fechas');

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

      // La fecha y hora del cobro la pone la API en hora de Huancayo (no la del
      // servidor MySQL, que en la nube suele estar en UTC): así el cuadre del día cuadra.
      const fechaPago = ahora();
      const [resultado] = await conexion.execute(
        `INSERT INTO pago (id_contrato, fecha_pago, monto, periodo_desde, periodo_hasta, medio_pago, nro_operacion, id_usuario)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id_contrato, fechaPago, monto, periodo.periodo_desde, periodo.periodo_hasta,
         medio_pago, nro_operacion, id_usuario]
      );

      // RN-09 (Sprint 2 · HU-05): cada pago genera su comprobante con número
      // correlativo. Se calcula dentro de la misma transacción; FOR UPDATE hace
      // que dos cajas que cobran a la vez no tomen el mismo número.
      const comprobante = await emitirComprobante(conexion, resultado.insertId, fechaPago);

      return {
        id_pago: resultado.insertId,
        id_abonado: contrato.id_abonado,
        id_contrato,
        monto,
        ...periodo,
        medio_pago,
        nro_operacion,
        comprobante
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

const SERIE = 'C001';

// "C001" + 4 → "C001-000004"
function codigoComprobante(serie, numero) {
  return `${serie}-${String(numero).padStart(6, '0')}`;
}

async function emitirComprobante(conexion, idPago, fechaEmision) {
  const [filas] = await conexion.execute(
    `SELECT COALESCE(MAX(numero), 0) + 1 AS siguiente
       FROM comprobante
      WHERE serie = ?
        FOR UPDATE`,
    [SERIE]
  );
  const numero = filas[0].siguiente;
  await conexion.execute(
    `INSERT INTO comprobante (id_pago, serie, numero, fecha_emision) VALUES (?, ?, ?, ?)`,
    [idPago, SERIE, numero, fechaEmision]
  );
  return { serie: SERIE, numero, codigo: codigoComprobante(SERIE, numero) };
}

// Historial de pagos de un abonado, del más reciente al más antiguo (T11)
async function historialDeAbonado(idAbonado) {
  const [filas] = await pool.execute(
    `SELECT p.id_pago, p.id_contrato, p.fecha_pago, p.monto, p.periodo_desde, p.periodo_hasta,
            p.medio_pago, p.nro_operacion, p.estado,
            p.fecha_anulacion, p.motivo_anulacion,
            u.nombre  AS registrado_por,
            ua.nombre AS anulado_por,
            v.placa_codigo, e.codigo AS codigo_espacio,
            cp.serie, cp.numero
       FROM pago p
       JOIN contrato c ON c.id_contrato = p.id_contrato
       JOIN vehiculo v ON v.id_vehiculo = c.id_vehiculo
       JOIN espacio  e ON e.id_espacio  = c.id_espacio
       JOIN usuario  u ON u.id_usuario  = p.id_usuario
       LEFT JOIN usuario ua ON ua.id_usuario = p.anulado_por
       LEFT JOIN comprobante cp ON cp.id_pago = p.id_pago
      WHERE c.id_abonado = ?
      ORDER BY p.fecha_pago DESC, p.id_pago DESC`,
    [idAbonado]
  );
  return filas.map(({ serie, numero, ...fila }) => ({
    ...fila,
    monto: Number(fila.monto),
    comprobante: numero ? codigoComprobante(serie, numero) : null
  }));
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
    // RN-09: el comprobante no se borra ni se edita; queda ANULADO
    await conexion.execute(`UPDATE comprobante SET estado = 'ANULADO' WHERE id_pago = ?`, [id_pago]);
    return { id_pago, id_abonado: pago.id_abonado, id_contrato: pago.id_contrato };
  });
}

/**
 * Sprint 2 · HU-04 · T19: pagos cobrados en un día ("AAAA-MM-DD"), con abonado,
 * placa y usuario. Incluye los anulados para que el cuadre los muestre aparte.
 */
async function pagosDelDia(fecha) {
  const [filas] = await pool.execute(
    `SELECT p.id_pago, p.fecha_pago, p.monto, p.medio_pago, p.nro_operacion, p.estado,
            CONCAT(a.nombres, ' ', a.apellidos) AS abonado, a.id_abonado,
            v.placa_codigo, u.nombre AS registrado_por
       FROM pago p
       JOIN contrato c ON c.id_contrato = p.id_contrato
       JOIN abonado  a ON a.id_abonado  = c.id_abonado
       JOIN vehiculo v ON v.id_vehiculo = c.id_vehiculo
       JOIN usuario  u ON u.id_usuario  = p.id_usuario
      WHERE p.fecha_pago >= ? AND p.fecha_pago < DATE_ADD(?, INTERVAL 1 DAY)
      ORDER BY p.fecha_pago, p.id_pago`,
    [fecha, fecha]
  );
  return filas.map(f => ({ ...f, monto: Number(f.monto) }));
}

/**
 * Sprint 2 · HU-05: todos los datos que van en el comprobante de un pago.
 * Devuelve null si el pago no existe.
 */
async function datosComprobante(idPago) {
  const [filas] = await pool.execute(
    `SELECT p.id_pago, p.fecha_pago, p.monto, p.periodo_desde, p.periodo_hasta,
            p.medio_pago, p.nro_operacion, p.estado AS estado_pago,
            cp.serie, cp.numero, cp.fecha_emision, cp.estado AS estado_comprobante,
            a.id_abonado, a.nombres, a.apellidos, a.dni, a.celular,
            v.tipo AS tipo_vehiculo, v.placa_codigo,
            e.codigo AS codigo_espacio, e.tipo AS tipo_espacio,
            u.nombre AS registrado_por
       FROM pago p
       JOIN comprobante cp ON cp.id_pago = p.id_pago
       JOIN contrato c ON c.id_contrato = p.id_contrato
       JOIN abonado  a ON a.id_abonado  = c.id_abonado
       JOIN vehiculo v ON v.id_vehiculo = c.id_vehiculo
       JOIN espacio  e ON e.id_espacio  = c.id_espacio
       JOIN usuario  u ON u.id_usuario  = p.id_usuario
      WHERE p.id_pago = ?`,
    [idPago]
  );
  if (!filas[0]) return null;
  const f = filas[0];
  return { ...f, monto: Number(f.monto), codigo: codigoComprobante(f.serie, f.numero) };
}

module.exports = { registrar, historialDeAbonado, anular, pagosDelDia, datosComprobante, codigoComprobante };

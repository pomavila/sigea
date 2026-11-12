/* =========================================================
   SIGEA · Modelo de abonados (tablas abonado, vehiculo, contrato)
   HU-01 · Tareas T04 (API) y T06 (datos para la regla de estado)
   ========================================================= */

'use strict';

const { pool, enTransaccion } = require('../config/db');
const { ErrorApi } = require('../utils/errores');

/* ---------------------------------------------------------
   Consulta base: una fila por CONTRATO VIGENTE, con su abonado,
   vehículo, espacio y la fecha hasta la que tiene pagado
   (pagado_hasta = el mayor periodo_hasta de sus pagos no anulados).
   --------------------------------------------------------- */
const SELECT_CONTRATOS = `
  SELECT a.id_abonado, a.nombres, a.apellidos, a.dni, a.direccion, a.celular, a.fecha_registro,
         c.id_contrato, c.tarifa_mensual, c.fecha_inicio, c.fecha_fin,
         v.id_vehiculo, v.tipo AS tipo_vehiculo, v.placa_codigo, v.descripcion AS descripcion_vehiculo,
         e.id_espacio, e.codigo AS codigo_espacio, e.tipo AS tipo_espacio,
         up.pagado_hasta, up.fecha_ultimo_pago
    FROM abonado a
    JOIN contrato c ON c.id_abonado = a.id_abonado AND c.estado = 'VIGENTE'
    JOIN vehiculo v ON v.id_vehiculo = c.id_vehiculo
    JOIN espacio  e ON e.id_espacio  = c.id_espacio
    LEFT JOIN (
           SELECT id_contrato,
                  MAX(periodo_hasta) AS pagado_hasta,
                  MAX(fecha_pago)    AS fecha_ultimo_pago
             FROM pago
            WHERE estado = 'REGISTRADO'
            GROUP BY id_contrato
         ) up ON up.id_contrato = c.id_contrato`;

// En un LIKE, % y _ son comodines. Si el usuario los escribe, se "escapan"
// para que se busquen como texto normal.
function escaparLike(texto) {
  return texto.replace(/[\\%_]/g, caracter => `\\${caracter}`);
}

// Lista de contratos vigentes; "buscar" filtra por nombre, apellido, DNI o placa
async function listarContratos({ buscar = '' } = {}) {
  const patron = `%${escaparLike(buscar)}%`;
  const [filas] = await pool.execute(
    `${SELECT_CONTRATOS}
      WHERE ? = ''
         OR a.nombres LIKE ?
         OR a.apellidos LIKE ?
         OR CONCAT(a.nombres, ' ', a.apellidos) LIKE ?
         OR a.dni LIKE ?
         OR v.placa_codigo LIKE ?
      ORDER BY a.apellidos, a.nombres, c.id_contrato`,
    [buscar, patron, patron, patron, patron, patron]
  );
  return filas;
}

async function contratosDeAbonado(idAbonado) {
  const [filas] = await pool.execute(
    `${SELECT_CONTRATOS}
      WHERE a.id_abonado = ?
      ORDER BY c.id_contrato`,
    [idAbonado]
  );
  return filas;
}

async function buscarPorId(idAbonado) {
  const [filas] = await pool.execute(
    `SELECT id_abonado, nombres, apellidos, dni, direccion, celular, fecha_registro
       FROM abonado
      WHERE id_abonado = ?`,
    [idAbonado]
  );
  return filas[0] || null;
}

// Traduce el error "dato duplicado" de MySQL a un mensaje claro (409).
// MySQL indica en el mensaje qué restricción UNIQUE se rompió.
function traducirDuplicado(error) {
  if (error.code !== 'ER_DUP_ENTRY') return error;
  const detalle = error.sqlMessage || '';
  if (detalle.includes('uq_abonado_dni')) {
    return new ErrorApi(409, 'Ya existe un abonado registrado con ese DNI.', {
      dni: 'Ya existe un abonado registrado con ese DNI.'
    });
  }
  if (detalle.includes('uq_vehiculo_placa')) {
    return new ErrorApi(409, 'Ya existe un vehículo registrado con esa placa o código.', {
      placa_codigo: 'Ya existe un vehículo registrado con esa placa o código.'
    });
  }
  if (detalle.includes('uq_contrato_espacio_vigente')) {
    return new ErrorApi(409, 'El espacio ya está ocupado.', {
      id_espacio: 'El espacio ya está ocupado.'
    });
  }
  return error;
}

/**
 * Registra abonado + vehículo + contrato en UNA transacción (T04).
 * Si cualquiera de los tres pasos falla, no se guarda nada.
 */
async function crearConContrato({ abonado, vehiculo, contrato }) {
  try {
    return await enTransaccion(async conexion => {
      // 1) RN-04: se bloquea la fila del espacio (FOR UPDATE) para que dos
      //    cajas no puedan asignar el mismo espacio al mismo tiempo.
      const [espacios] = await conexion.execute(
        'SELECT id_espacio, codigo, estado FROM espacio WHERE id_espacio = ? FOR UPDATE',
        [contrato.id_espacio]
      );
      const espacio = espacios[0];
      if (!espacio) {
        throw new ErrorApi(400, 'El espacio seleccionado no existe.', {
          id_espacio: 'El espacio seleccionado no existe.'
        });
      }
      if (espacio.estado !== 'LIBRE') {
        throw new ErrorApi(409, 'El espacio ya está ocupado.', {
          id_espacio: 'El espacio ya está ocupado.'
        });
      }

      // 2) Abonado
      const [resAbonado] = await conexion.execute(
        `INSERT INTO abonado (nombres, apellidos, dni, direccion, celular)
         VALUES (?, ?, ?, ?, ?)`,
        [abonado.nombres, abonado.apellidos, abonado.dni, abonado.direccion, abonado.celular]
      );
      const idAbonado = resAbonado.insertId;

      // 3) Vehículo
      const [resVehiculo] = await conexion.execute(
        `INSERT INTO vehiculo (id_abonado, tipo, placa_codigo, descripcion)
         VALUES (?, ?, ?, ?)`,
        [idAbonado, vehiculo.tipo, vehiculo.placa_codigo, vehiculo.descripcion]
      );

      // 4) Contrato
      const [resContrato] = await conexion.execute(
        `INSERT INTO contrato (id_abonado, id_vehiculo, id_espacio, tarifa_mensual, fecha_inicio, fecha_fin)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [idAbonado, resVehiculo.insertId, contrato.id_espacio,
         contrato.tarifa_mensual, contrato.fecha_inicio, contrato.fecha_fin]
      );

      // 5) El espacio pasa a OCUPADO
      await conexion.execute(
        "UPDATE espacio SET estado = 'OCUPADO' WHERE id_espacio = ?",
        [contrato.id_espacio]
      );

      return { id_abonado: idAbonado, id_contrato: resContrato.insertId };
    });
  } catch (error) {
    throw traducirDuplicado(error);
  }
}

async function actualizar(idAbonado, datos) {
  try {
    const [resultado] = await pool.execute(
      `UPDATE abonado
          SET nombres = ?, apellidos = ?, dni = ?, direccion = ?, celular = ?
        WHERE id_abonado = ?`,
      [datos.nombres, datos.apellidos, datos.dni, datos.direccion, datos.celular, idAbonado]
    );
    return resultado.affectedRows > 0;
  } catch (error) {
    throw traducirDuplicado(error);
  }
}

module.exports = {
  listarContratos,
  contratosDeAbonado,
  buscarPorId,
  crearConContrato,
  actualizar
};

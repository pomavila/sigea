/* =========================================================
   SIGEA · Modelo de alertas de salida (tabla alerta_salida)
   Sprint 2 · HU-03 · Tareas T13 y T14
   ========================================================= */

'use strict';

const { pool } = require('../config/db');

// Guarda una consulta de salida con su resultado (RN-07)
async function registrar({ placa, id_contrato, saldo_detectado, resultado, fecha_hora, id_usuario }) {
  const [r] = await pool.execute(
    `INSERT INTO alerta_salida (placa, id_contrato, saldo_detectado, resultado, fecha_hora, id_usuario)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [placa, id_contrato, saldo_detectado, resultado, fecha_hora, id_usuario]
  );
  return r.insertId;
}

// Alertas de un día ("AAAA-MM-DD"), de la más reciente a la más antigua
async function listarPorFecha(fecha) {
  const [filas] = await pool.execute(
    `SELECT al.id_alerta, al.placa, al.id_contrato, al.saldo_detectado, al.resultado, al.fecha_hora,
            u.nombre AS registrado_por,
            a.id_abonado, CONCAT(a.nombres, ' ', a.apellidos) AS abonado
       FROM alerta_salida al
       JOIN usuario u        ON u.id_usuario  = al.id_usuario
       LEFT JOIN contrato c  ON c.id_contrato = al.id_contrato
       LEFT JOIN abonado a   ON a.id_abonado  = c.id_abonado
      WHERE al.fecha_hora >= ? AND al.fecha_hora < DATE_ADD(?, INTERVAL 1 DAY)
      ORDER BY al.fecha_hora DESC, al.id_alerta DESC`,
    [fecha, fecha]
  );
  return filas.map(f => ({ ...f, saldo_detectado: Number(f.saldo_detectado) }));
}

module.exports = { registrar, listarPorFecha };

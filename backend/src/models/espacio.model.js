/* =========================================================
   SIGEA · Modelo de espacios (tabla espacio)
   ========================================================= */

'use strict';

const { pool } = require('../config/db');

// Los filtros son opcionales: (? IS NULL OR columna = ?) ignora el filtro si llega null
async function listar({ tipo = null, estado = null } = {}) {
  const [filas] = await pool.execute(
    `SELECT id_espacio, codigo, tipo, estado
       FROM espacio
      WHERE (? IS NULL OR tipo = ?)
        AND (? IS NULL OR estado = ?)
      ORDER BY tipo, codigo`,
    [tipo, tipo, estado, estado]
  );
  return filas;
}

async function contarPorEstado() {
  const [filas] = await pool.execute(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(estado = 'LIBRE'), 0)   AS libres,
            COALESCE(SUM(estado = 'OCUPADO'), 0) AS ocupados
       FROM espacio`
  );
  return {
    total: Number(filas[0].total),
    libres: Number(filas[0].libres),
    ocupados: Number(filas[0].ocupados)
  };
}

module.exports = { listar, contarPorEstado };

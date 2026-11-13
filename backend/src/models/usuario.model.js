/* =========================================================
   SIGEA · Modelo de usuarios (tabla usuario)
   Los modelos son los únicos archivos que hablan con MySQL.
   Siempre se usan consultas con "?" (consultas preparadas):
   el valor nunca se pega dentro del texto SQL, y así no es
   posible una inyección SQL.
   ========================================================= */

'use strict';

const { pool } = require('../config/db');

// Incluye contrasena_hash: solo se usa para comparar en el inicio de sesión
async function buscarPorUsuario(usuario) {
  const [filas] = await pool.execute(
    `SELECT id_usuario, nombre, usuario, contrasena_hash, rol, activo
       FROM usuario
      WHERE usuario = ?`,
    [usuario]
  );
  return filas[0] || null;
}

async function buscarPorId(idUsuario) {
  const [filas] = await pool.execute(
    `SELECT id_usuario, nombre, usuario, rol, activo
       FROM usuario
      WHERE id_usuario = ?`,
    [idUsuario]
  );
  return filas[0] || null;
}

async function crear({ nombre, usuario, contrasenaHash, rol }) {
  const [resultado] = await pool.execute(
    `INSERT INTO usuario (nombre, usuario, contrasena_hash, rol)
     VALUES (?, ?, ?, ?)`,
    [nombre, usuario, contrasenaHash, rol]
  );
  return resultado.insertId;
}

module.exports = { buscarPorUsuario, buscarPorId, crear };

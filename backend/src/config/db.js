
const mysql = require("mysql2/promise");
require("dotenv").config({ quiet: true });

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  // Las columnas DATE y DATETIME llegan como texto ("2026-11-09").
  // Así no cambian de día por culpa de la zona horaria.
  dateStrings: true
});

async function probarConexion() {
  const conexion = await pool.getConnection();

  try {
    await conexion.ping();
    console.log("Conexión a MySQL exitosa");
  } finally {
    conexion.release();
  }
}

/**
 * Ejecuta varias consultas dentro de UNA transacción.
 * Si todo sale bien se confirma (COMMIT); si algo falla se deshace
 * todo (ROLLBACK), como si nada hubiera pasado.
 *
 * Uso:  const resultado = await enTransaccion(async (conexion) => { ... });
 */
async function enTransaccion(trabajo) {
  const conexion = await pool.getConnection();

  try {
    await conexion.beginTransaction();
    const resultado = await trabajo(conexion);
    await conexion.commit();
    return resultado;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release(); // la conexión siempre vuelve al pool
  }
}

module.exports = { pool, probarConexion, enTransaccion };

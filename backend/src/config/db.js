
const mysql = require("mysql2/promise");
require("dotenv").config({ quiet: true });

/**
 * SSL para bases MySQL en la nube (Aiven, TiDB Cloud, Azure...).
 * En la computadora local no se usa. Se activa con DB_SSL=true.
 * Si el proveedor entrega un certificado (ca.pem), su contenido va en DB_SSL_CA
 * (se aceptan saltos de línea escritos como \n).
 */
function opcionesSsl() {
  if (String(process.env.DB_SSL).toLowerCase() !== 'true') return undefined;
  const ca = process.env.DB_SSL_CA ? process.env.DB_SSL_CA.replace(/\\n/g, '\n') : undefined;
  return { rejectUnauthorized: true, minVersion: 'TLSv1.2', ...(ca ? { ca } : {}) };
}

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
  dateStrings: true,
  ssl: opcionesSsl()
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

module.exports = { pool, probarConexion, enTransaccion, opcionesSsl };

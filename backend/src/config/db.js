
const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
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

module.exports = { pool, probarConexion };


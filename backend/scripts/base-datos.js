/* =========================================================
   SIGEA · Crear la base de datos desde los archivos .sql
   Ejecuta database/schema.sql y database/seed.sql sin tener que
   abrir MySQL Workbench. Lo usan "npm run db:reset" y las pruebas.
   ========================================================= */

'use strict';

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const CARPETA_SQL = path.join(__dirname, '..', '..', 'database');

/**
 * BORRA la base indicada (si existe) y la vuelve a crear con tablas y datos de prueba.
 * @param {string} nombreBase  Por ejemplo "sigea_db" o "sigea_test"
 */
async function recrearBase(nombreBase) {
  // El nombre se inserta en el SQL, así que solo se aceptan letras, números y guion bajo
  if (!/^[A-Za-z0-9_]+$/.test(nombreBase)) {
    throw new Error('Nombre de base de datos no válido: ' + nombreBase);
  }

  const conexion = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true // permite ejecutar un archivo .sql completo
  });

  try {
    await conexion.query(`DROP DATABASE IF EXISTS \`${nombreBase}\``);
    for (const archivo of ['schema.sql', 'seed.sql']) {
      const sql = fs.readFileSync(path.join(CARPETA_SQL, archivo), 'utf8')
        .replace(/\bsigea_db\b/g, nombreBase); // los .sql usan el nombre sigea_db
      await conexion.query(sql);
    }
  } finally {
    await conexion.end();
  }
}

module.exports = { recrearBase };

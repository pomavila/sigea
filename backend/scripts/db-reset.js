/* =========================================================
   SIGEA · npm run db:reset
   Deja la base de datos del .env (DB_NAME) como recién instalada:
   tablas vacías + datos de prueba de database/seed.sql.

   CUIDADO: borra todos los datos que tenga esa base.
   Pide confirmación, salvo que se ejecute con:  npm run db:reset -- --si
   ========================================================= */

'use strict';

const readline = require('readline/promises');
const { recrearBase } = require('./base-datos');

async function main() {
  const nombreBase = process.env.DB_NAME;
  if (!nombreBase) {
    throw new Error('Falta DB_NAME en backend/.env');
  }

  if (!process.argv.includes('--si')) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const respuesta = await rl.question(
      `Se BORRARÁN todos los datos de la base "${nombreBase}". Escriba SI para continuar: `
    );
    rl.close();
    if (respuesta.trim().toUpperCase() !== 'SI') {
      console.log('Cancelado. No se modificó nada.');
      return;
    }
  }

  await recrearBase(nombreBase);
  console.log(`Base "${nombreBase}" creada con los datos de prueba.`);
  console.log('Usuarios de prueba: caja01 y gerencia01 (contraseñas en database/seed.sql).');
}

main().catch(error => {
  console.error('No se pudo crear la base:', error.message);
  process.exit(1);
});

/* =========================================================
   SIGEA · Crear un usuario del sistema (T08)
   Uso:
     node scripts/crear-usuario.js <usuario> <ROL> "<Nombre completo>"
   Ejemplo:
     node scripts/crear-usuario.js elisa.campos CAJA "Elisa Campos Yaranga"

   La contraseña se pide por teclado (no queda en el historial de
   comandos) y se guarda cifrada con bcrypt (RN-06).
   ========================================================= */

'use strict';

const readline = require('readline');
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');
const usuarioModel = require('../src/models/usuario.model');
const { ROLES } = require('../src/config/seguridad');

const COSTO_BCRYPT = 12; // cuanto mayor, más lento de calcular y más difícil de atacar

// Pide un dato por teclado sin mostrar lo que se escribe
function pedirContrasena(pregunta) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(pregunta, respuesta => {
      rl.close();
      process.stdout.write('\n');
      resolve(respuesta);
    });
    rl._writeToOutput = () => {}; // después de mostrar la pregunta, ya no se imprime nada
  });
}

async function main() {
  const [usuario, rolRecibido, nombre] = process.argv.slice(2);
  const rol = String(rolRecibido || '').toUpperCase();

  if (!usuario || !nombre || !Object.values(ROLES).includes(rol)) {
    console.log('Uso: node scripts/crear-usuario.js <usuario> <CAJA|GERENCIA|OPERATIVO> "<Nombre completo>"');
    process.exitCode = 1;
    return;
  }
  if (!/^[a-z0-9._-]{4,30}$/.test(usuario)) {
    throw new Error('El usuario debe tener de 4 a 30 caracteres: minúsculas, números, punto, guion o guion bajo.');
  }
  if (await usuarioModel.buscarPorUsuario(usuario)) {
    throw new Error(`El usuario "${usuario}" ya existe.`);
  }

  const contrasena = await pedirContrasena('Contraseña (mínimo 8 caracteres): ');
  if (contrasena.length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres.');
  }
  const repetida = await pedirContrasena('Repita la contraseña: ');
  if (contrasena !== repetida) {
    throw new Error('Las contraseñas no coinciden.');
  }

  const contrasenaHash = await bcrypt.hash(contrasena, COSTO_BCRYPT);
  const id = await usuarioModel.crear({ nombre, usuario, contrasenaHash, rol });
  console.log(`Usuario "${usuario}" creado con rol ${rol} (id ${id}).`);
}

main()
  .catch(error => {
    console.error('No se pudo crear el usuario:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

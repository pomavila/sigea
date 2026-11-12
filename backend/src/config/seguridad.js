/* =========================================================
   SIGEA · Configuración de seguridad (RN-06)
   La clave del JWT vive SOLO en el archivo .env (nunca en el
   código ni en GitHub). Si falta, el servidor no arranca.
   ========================================================= */

'use strict';

require('dotenv').config({ quiet: true });

const CLAVE_DE_EJEMPLO = 'reemplazar_con_clave_segura';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h'; // RN-06: la sesión dura 8 horas

function validarConfiguracion() {
  if (!JWT_SECRET) {
    throw new Error('Falta JWT_SECRET en el archivo .env (ver .env.example).');
  }
  if (JWT_SECRET === CLAVE_DE_EJEMPLO) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET sigue con el valor de ejemplo. Cámbielo antes de publicar.');
    }
    console.warn('AVISO: JWT_SECRET tiene el valor de ejemplo. Cámbielo en backend/.env.');
  }
}

// Roles del sistema (los mismos del ENUM de la tabla usuario)
const ROLES = Object.freeze({
  CAJA: 'CAJA',
  GERENCIA: 'GERENCIA',
  OPERATIVO: 'OPERATIVO'
});

module.exports = { JWT_SECRET, JWT_EXPIRES_IN, ROLES, validarConfiguracion };

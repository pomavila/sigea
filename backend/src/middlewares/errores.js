/* =========================================================
   SIGEA · Manejo central de errores
   Todos los errores de la API terminan aquí y salen con el
   mismo formato JSON:  { "mensaje": "...", "errores": { campo: "..." } }
   (El frontend lee "mensaje" para mostrarlo en la alerta roja.)
   ========================================================= */

'use strict';

const { ErrorApi } = require('../utils/errores');

// Rutas /api/... que no existen
function rutaNoEncontrada(req, res) {
  res.status(404).json({ mensaje: 'La ruta solicitada no existe.' });
}

// Express reconoce un manejador de errores porque recibe 4 parámetros
// eslint-disable-next-line no-unused-vars
function manejarErrores(error, req, res, next) {
  // 1) Errores esperados (validación, permisos, no encontrado...)
  if (error instanceof ErrorApi) {
    const cuerpo = { mensaje: error.message };
    if (error.errores) cuerpo.errores = error.errores;
    return res.status(error.status).json(cuerpo);
  }

  // 2) El cliente envió un JSON mal escrito o demasiado grande
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ mensaje: 'El cuerpo de la petición no es un JSON válido.' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ mensaje: 'La petición es demasiado grande.' });
  }

  // 3) Error inesperado: el detalle va al registro del servidor,
  //    nunca al usuario (podría revelar datos internos).
  console.error('Error no controlado:', error);
  res.status(500).json({ mensaje: 'Ocurrió un error en el servidor. Intente nuevamente.' });
}

module.exports = { rutaNoEncontrada, manejarErrores };

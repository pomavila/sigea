/* =========================================================
   SIGEA · Errores de la API
   ErrorApi representa un error "esperado" (dato inválido, sin
   permiso, no encontrado...). El manejador de errores lo
   convierte en una respuesta JSON con su código HTTP.

   Códigos que usa SIGEA:
     400 datos inválidos        401 no ha iniciado sesión
     403 su rol no tiene permiso 404 no existe
     409 choca con un dato existente (DNI repetido, espacio ocupado)
   ========================================================= */

'use strict';

class ErrorApi extends Error {
  /**
   * @param {number} status   Código HTTP
   * @param {string} mensaje  Texto que verá el usuario
   * @param {object} [errores] Errores por campo: { dni: 'El DNI debe tener 8 dígitos.' }
   */
  constructor(status, mensaje, errores) {
    super(mensaje);
    this.status = status;
    this.errores = errores;
  }
}

// Convierte un parámetro de la URL (/abonados/:id) en entero positivo o lanza 400
function leerId(valor, nombre = 'id') {
  if (!/^\d{1,9}$/.test(String(valor)) || Number(valor) < 1) {
    throw new ErrorApi(400, `El ${nombre} no es válido.`);
  }
  return Number(valor);
}

// Si hay errores de validación, lanza un 400 con el detalle por campo
function lanzarSiHayErrores(errores) {
  const mensajes = Object.values(errores);
  if (mensajes.length === 0) return;
  throw new ErrorApi(400, mensajes[0], errores);
}

module.exports = { ErrorApi, leerId, lanzarSiHayErrores };

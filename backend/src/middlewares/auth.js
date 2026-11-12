/* =========================================================
   SIGEA · Middlewares de autenticación y roles (T08)
   Un middleware es una función que se ejecuta ANTES del
   controlador y decide si la petición puede continuar.

     verificarToken  -> ¿inició sesión?           si no: 401
     permitirRoles   -> ¿su rol tiene permiso?    si no: 403
   ========================================================= */

'use strict';

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/seguridad');
const { ErrorApi } = require('../utils/errores');
const usuarioModel = require('../models/usuario.model');

// Lee el header  Authorization: Bearer <token>
async function verificarToken(req, res, next) {
  const cabecera = req.headers.authorization || '';
  const [tipo, token] = cabecera.split(' ');

  if (tipo !== 'Bearer' || !token) {
    throw new ErrorApi(401, 'Debe iniciar sesión.');
  }

  let datos;
  try {
    // Se fija el algoritmo para que nadie pueda presentar un token firmado de otra forma
    datos = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    // Token alterado o vencido (RN-06: dura 8 horas)
    throw new ErrorApi(401, 'Su sesión expiró. Vuelva a iniciar sesión.');
  }

  // Se consulta el usuario en cada petición: si lo desactivan o le cambian
  // el rol, el cambio se aplica al instante aunque su token siga vigente.
  const usuario = await usuarioModel.buscarPorId(datos.sub);
  if (!usuario || !usuario.activo) {
    throw new ErrorApi(401, 'Su sesión expiró. Vuelva a iniciar sesión.');
  }

  req.usuario = {
    id_usuario: usuario.id_usuario,
    nombre: usuario.nombre,
    usuario: usuario.usuario,
    rol: usuario.rol
  };
  next();
}

// Uso en una ruta:  permitirRoles('CAJA', 'GERENCIA')
function permitirRoles(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      throw new ErrorApi(403, 'Acceso denegado: su rol no tiene permiso para esta acción.');
    }
    next();
  };
}

module.exports = { verificarToken, permitirRoles };

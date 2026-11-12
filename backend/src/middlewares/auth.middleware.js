/* =========================================================
   SIGEA · Middlewares de autenticación y roles (T08)
   Un middleware es una función que se ejecuta ANTES del
   controlador y decide si la petición puede continuar.

     verificarToken  -> ¿inició sesión?           si no: 401
     permitirRoles   -> ¿su rol tiene permiso?    si no: 403
   ========================================================= */

const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/seguridad");
const { ErrorApi } = require("../utils/errores");
const usuarioModel = require("../models/usuario.model");

// RN-06: Verificar que el usuario tenga un JWT válido
// Lee el header  Authorization: Bearer <token>
async function verificarToken(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization) {
    throw new ErrorApi(401, "Token no proporcionado");
  }

  const partes = authorization.split(" ");

  if (partes.length !== 2 || partes[0] !== "Bearer" || !partes[1]) {
    throw new ErrorApi(401, "Formato de token inválido");
  }

  let datos;
  try {
    // Se fija el algoritmo para que nadie pueda presentar un token firmado de otra forma
    datos = jwt.verify(partes[1], JWT_SECRET, { algorithms: ["HS256"] });
  } catch (error) {
    throw new ErrorApi(401, "Token inválido o vencido");
  }

  // Se consulta el usuario en cada petición: si lo desactivan o le cambian
  // el rol, el cambio se aplica al instante aunque su token siga vigente.
  const usuario = await usuarioModel.buscarPorId(datos.id_usuario);
  if (!usuario || Number(usuario.activo) !== 1) {
    throw new ErrorApi(401, "Token inválido o vencido");
  }

  req.usuario = {
    id_usuario: usuario.id_usuario,
    nombre: usuario.nombre,
    usuario: usuario.usuario,
    rol: usuario.rol
  };

  next();
}

// RN-05: Permitir acceso solo a determinados roles
// Uso en una ruta:  permitirRoles("CAJA", "GERENCIA")
function permitirRoles(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      throw new ErrorApi(401, "No autenticado");
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      throw new ErrorApi(403, "Acceso denegado");
    }

    next();
  };
}

module.exports = {
  verificarToken,
  permitirRoles
};

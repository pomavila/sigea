
const jwt = require("jsonwebtoken");

// RN-06: Verificar que el usuario tenga un JWT válido
function verificarToken(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).json({
      mensaje: "Token no proporcionado"
    });
  }

  const partes = authorization.split(" ");

  if (
    partes.length !== 2 ||
    partes[0] !== "Bearer" ||
    !partes[1]
  ) {
    return res.status(401).json({
      mensaje: "Formato de token inválido"
    });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({
      mensaje: "Error de configuración del servidor"
    });
  }

  try {
    const datos = jwt.verify(
      partes[1],
      process.env.JWT_SECRET,
      { algorithms: ["HS256"] }
    );

    req.usuario = {
      id_usuario: datos.id_usuario,
      nombre: datos.nombre,
      rol: datos.rol
    };

    next();
  } catch (error) {
    return res.status(401).json({
      mensaje: "Token inválido o vencido"
    });
  }
}

// RN-05: Permitir acceso solo a determinados roles
function permitirRoles(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({
        mensaje: "No autenticado"
      });
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({
        mensaje: "Acceso denegado"
      });
    }

    next();
  };
}

module.exports = {
  verificarToken,
  permitirRoles
};


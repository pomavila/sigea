/* =========================================================
   SIGEA · Controlador de autenticación (T08)
   Un controlador recibe la petición, llama a los modelos o
   servicios y devuelve la respuesta JSON.
   ========================================================= */

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const usuarioModel = require("../models/usuario.model");
const { JWT_SECRET, JWT_EXPIRES_IN } = require("../config/seguridad");
const { ErrorApi } = require("../utils/errores");
const limiteLogin = require("../middlewares/limiteLogin");

// Mismo mensaje para todos los fallos: no se revela si falló el usuario o la contraseña
const mensajeError = "Usuario o contraseña incorrectos";

// Hash de relleno: se usa cuando el usuario no existe, para que la respuesta
// tarde lo mismo que con un usuario real y no se pueda adivinar qué cuentas existen.
const HASH_DE_RELLENO = bcrypt.hashSync("sigea-relleno", 10);

// POST /api/auth/login  →  { usuario, contrasena }
async function login(req, res) {
  const { usuario, contrasena } = req.body || {};

  if (
    typeof usuario !== "string" ||
    typeof contrasena !== "string" ||
    !usuario.trim() ||
    !contrasena
  ) {
    throw new ErrorApi(401, mensajeError);
  }

  // Se usa el pool de conexiones (src/config/db.js) a través del modelo
  const usuarioEncontrado = await usuarioModel.buscarPorUsuario(usuario.trim());

  // bcrypt.compare cifra la contraseña recibida y la compara con el hash guardado.
  // La contraseña original nunca se guarda ni se puede recuperar.
  const contrasenaCorrecta = await bcrypt.compare(
    contrasena,
    usuarioEncontrado ? usuarioEncontrado.contrasena_hash : HASH_DE_RELLENO
  );

  if (!usuarioEncontrado || !contrasenaCorrecta || Number(usuarioEncontrado.activo) !== 1) {
    limiteLogin.registrarFallo(req);
    throw new ErrorApi(401, mensajeError);
  }

  limiteLogin.registrarExito(req);

  // El token lleva solo lo necesario para identificar al usuario (nunca la contraseña)
  const token = jwt.sign(
    {
      id_usuario: usuarioEncontrado.id_usuario,
      nombre: usuarioEncontrado.nombre,
      rol: usuarioEncontrado.rol
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN, algorithm: "HS256" } // RN-06: 8 horas
  );

  return res.status(200).json({
    mensaje: "Inicio de sesión exitoso",
    token,
    tipo: "Bearer",
    expira_en: JWT_EXPIRES_IN,
    usuario: {
      id_usuario: usuarioEncontrado.id_usuario,
      nombre: usuarioEncontrado.nombre,
      usuario: usuarioEncontrado.usuario,
      rol: usuarioEncontrado.rol
    }
  });
}

module.exports = { login };

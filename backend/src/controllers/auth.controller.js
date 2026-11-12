/* =========================================================
   SIGEA · Controlador de autenticación (T08)
   Un controlador recibe la petición, llama a los modelos o
   servicios y devuelve la respuesta JSON.
   ========================================================= */

'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const usuarioModel = require('../models/usuario.model');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/seguridad');
const { ErrorApi } = require('../utils/errores');
const limiteLogin = require('../middlewares/limiteLogin');

// Hash de relleno: se usa cuando el usuario no existe, para que la respuesta
// tarde lo mismo que con un usuario real y no se pueda adivinar qué cuentas existen.
const HASH_DE_RELLENO = bcrypt.hashSync('sigea-relleno', 10);

// POST /api/auth/login  →  { usuario, contrasena }
async function login(req, res) {
  const usuario = typeof req.body?.usuario === 'string' ? req.body.usuario.trim() : '';
  const contrasena = typeof req.body?.contrasena === 'string' ? req.body.contrasena : '';

  if (!usuario || !contrasena) {
    throw new ErrorApi(400, 'Ingrese su usuario y su contraseña.');
  }

  const encontrado = await usuarioModel.buscarPorUsuario(usuario);

  // bcrypt.compare cifra la contraseña recibida y la compara con el hash guardado.
  // La contraseña original nunca se guarda ni se puede recuperar.
  const coincide = await bcrypt.compare(contrasena, encontrado ? encontrado.contrasena_hash : HASH_DE_RELLENO);

  if (!encontrado || !coincide || !encontrado.activo) {
    limiteLogin.registrarFallo(req);
    // Mismo mensaje en todos los casos: no se revela cuál de los dos datos falló
    throw new ErrorApi(401, 'Usuario o contraseña incorrectos.');
  }

  limiteLogin.registrarExito(req);

  // El token lleva solo lo necesario para identificar al usuario (nunca la contraseña).
  // "sub" (subject) es el nombre estándar para el id del dueño del token.
  const token = jwt.sign(
    { sub: encontrado.id_usuario, usuario: encontrado.usuario, rol: encontrado.rol },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: JWT_EXPIRES_IN }
  );

  res.json({
    token,
    usuario: {
      id_usuario: encontrado.id_usuario,
      nombre: encontrado.nombre,
      usuario: encontrado.usuario,
      rol: encontrado.rol
    }
  });
}

// GET /api/auth/perfil  →  datos del usuario que inició sesión
function perfil(req, res) {
  res.json(req.usuario);
}

module.exports = { login, perfil };

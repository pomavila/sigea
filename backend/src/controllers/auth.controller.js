
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2/promise");

const mensajeError = "Usuario o contraseña incorrectos";

async function login(req, res) {
  try {
    const { usuario, contrasena } = req.body || {};

    if (
      typeof usuario !== "string" ||
      typeof contrasena !== "string" ||
      !usuario.trim() ||
      !contrasena
    ) {
      return res.status(401).json({ mensaje: mensajeError });
    }

    const conexion = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    let usuarios;

    try {
      [usuarios] = await conexion.execute(
        `SELECT id_usuario, nombre, usuario, contrasena_hash, rol, activo
         FROM usuario
         WHERE usuario = ?
         LIMIT 1`,
        [usuario.trim()]
      );
    } finally {
      await conexion.end();
    }

    const usuarioEncontrado = usuarios[0];

    if (!usuarioEncontrado) {
      return res.status(401).json({ mensaje: mensajeError });
    }

    const contrasenaCorrecta = await bcrypt.compare(
      contrasena,
      usuarioEncontrado.contrasena_hash
    );

    if (!contrasenaCorrecta || Number(usuarioEncontrado.activo) !== 1) {
      return res.status(401).json({ mensaje: mensajeError });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET no está configurado");
    }

    const token = jwt.sign(
      {
        id_usuario: usuarioEncontrado.id_usuario,
        nombre: usuarioEncontrado.nombre,
        rol: usuarioEncontrado.rol
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h", algorithm: "HS256" }
    );

    return res.status(200).json({
      mensaje: "Inicio de sesión exitoso",
      token,
      tipo: "Bearer",
      expira_en: "8h",
      usuario: {
        id_usuario: usuarioEncontrado.id_usuario,
        nombre: usuarioEncontrado.nombre,
        rol: usuarioEncontrado.rol
      }
    });
  } catch (error) {
    console.error("Error en login:", error.message);

    return res.status(500).json({
      mensaje: "Error interno del servidor"
    });
  }
}

module.exports = { login };


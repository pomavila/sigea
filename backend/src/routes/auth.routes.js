
const express = require("express");
const router = express.Router();

const { login } = require("../controllers/auth.controller");

const {
  verificarToken,
  permitirRoles
} = require("../middlewares/auth.middleware");

// Ruta pública para iniciar sesión
router.post("/login", login);

// Ruta protegida para usuarios autenticados
router.get("/perfil", verificarToken, (req, res) => {
  res.status(200).json({
    mensaje: "Token válido",
    usuario: req.usuario
  });
});

// Ruta exclusiva para GERENCIA
router.get(
  "/prueba-gerencia",
  verificarToken,
  permitirRoles("GERENCIA"),
  (req, res) => {
    res.status(200).json({
      mensaje: "Acceso autorizado para GERENCIA"
    });
  }
);

module.exports = router;


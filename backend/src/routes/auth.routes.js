
const express = require("express");
const router = express.Router();

const { login } = require("../controllers/auth.controller");
const { revisarBloqueo } = require("../middlewares/limiteLogin");

const {
  verificarToken,
  permitirRoles
} = require("../middlewares/auth.middleware");

// Ruta pública para iniciar sesión
// (revisarBloqueo corta el paso tras 5 intentos fallidos seguidos)
router.post("/login", revisarBloqueo, login);

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

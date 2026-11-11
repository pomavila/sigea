

require("dotenv").config();

const express = require("express");
const { probarConexion } = require("./src/config/db");
const authRoutes = require("./src/routes/auth.routes");

const app = express();
const PORT = process.env.PORT || 3000;
// Permite recibir datos en formato JSON
app.use(express.json());

// Ruta para comprobar que el servidor funciona
app.get("/api/salud", (req, res) => {
  res.status(200).json({
    estado: "ok"
  });
});

// Rutas de autenticación: login con JWT
app.use("/api/auth", authRoutes);

// Iniciar servidor después de verificar MySQL
async function iniciarServidor() {
  try {
    await probarConexion();

    app.listen(PORT, () => {
      console.log("SIGEA ejecutándose en puerto " + PORT);
    });

  } catch (error) {
    console.error("Error al iniciar SIGEA:", error.message);
    process.exit(1);
  }
}

iniciarServidor();

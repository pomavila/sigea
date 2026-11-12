
require("dotenv").config({ quiet: true });

const path = require("path");
const express = require("express");
const cors = require("cors");
const { probarConexion } = require("./src/config/db");
const { validarConfiguracion } = require("./src/config/seguridad");
const rutasApi = require("./src/routes");
const { rutaNoEncontrada, manejarErrores } = require("./src/middlewares/errores");

const app = express();
const PORT = process.env.PORT || 3000;

app.disable("x-powered-by"); // no anunciar qué tecnología usa el servidor

// CORS: permite que el frontend llame a la API desde otro origen
// (por ejemplo, al abrir los archivos .html directamente o con Live Server).
// Para restringirlo, definir CORS_ORIGIN en .env con los orígenes separados por coma.
const origenes = (process.env.CORS_ORIGIN || "").split(",").map(o => o.trim()).filter(Boolean);
app.use(cors(origenes.length ? { origin: origenes } : {}));

app.use(express.json({ limit: "100kb" }));

// Las respuestas de la API tienen datos personales: el navegador no debe guardarlas en caché
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// API REST
app.use("/api", rutasApi);
app.use("/api", rutaNoEncontrada);

// Frontend: el mismo servidor entrega las páginas en http://localhost:3000
app.use(express.static(path.join(__dirname, "..", "frontend")));

// Manejador de errores (siempre al final)
app.use(manejarErrores);

async function iniciarServidor() {
  try {
    validarConfiguracion();
    await probarConexion();

    return app.listen(PORT, () => {
      console.log("SIGEA ejecutándose en puerto " + PORT);
      console.log("Abrir en el navegador: http://localhost:" + PORT);
    });

  } catch (error) {
    console.error("Error al iniciar SIGEA:", error.message);
    process.exit(1);
  }
}

// Solo se inicia el servidor cuando se ejecuta "node app.js".
// En las pruebas automáticas se importa "app" sin abrir el puerto fijo.
if (require.main === module) {
  iniciarServidor();
}

module.exports = { app, iniciarServidor };

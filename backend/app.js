
require("dotenv").config();

const express = require("express");
const { probarConexion } = require("./src/config/db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/api/salud", (req, res) => {
  res.status(200).json({
    estado: "ok"
  });
});

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


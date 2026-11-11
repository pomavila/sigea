
const bcrypt = require("bcrypt");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
const readline = require("node:readline/promises");

dotenv.config({ path: require("node:path").join(__dirname, "../.env") });

async function crearUsuario() {
  const conexion = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    const usuario = (await rl.question("Usuario: ")).trim();
    const nombre = (await rl.question("Nombre completo: ")).trim();
    const rol = (await rl.question("Rol (CAJA/GERENCIA/OPERATIVO): "))
      .trim().toUpperCase();
    const contrasena = await rl.question("Contraseña: ");

    if (!usuario || !nombre || contrasena.length < 8) {
      throw new Error("Completa los campos y usa una contraseña de al menos 8 caracteres.");
    }

    if (!["CAJA", "GERENCIA", "OPERATIVO"].includes(rol)) {
      throw new Error("Rol no permitido.");
    }

    const contrasenaHash = await bcrypt.hash(contrasena, 10);

    await conexion.execute(
      `INSERT INTO usuario
       (nombre, usuario, contrasena_hash, rol, activo)
       VALUES (?, ?, ?, ?, 1)`,
      [nombre, usuario, contrasenaHash, rol]
    );

    console.log("Usuario creado correctamente:", usuario);
  } catch (error) {
    console.error("Error al crear usuario:", error.message);
    process.exitCode = 1;
  } finally {
    rl.close();
    await conexion.end();
  }
}

crearUsuario().catch((error) => {
  console.error("Error de conexión:", error.message);
  process.exitCode = 1;
});

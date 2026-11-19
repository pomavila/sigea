# Publicar SIGEA en la nube · Sprint 2 (T24)

SIGEA se publica con dos servicios gratuitos:

| Parte | Servicio | Qué hace |
|-------|----------|----------|
| Base de datos | **Aiven for MySQL** (plan *Free*) | MySQL 8 en la nube, con SSL |
| API + frontend | **Render** (plan *Free*) | Ejecuta `backend/app.js`, que también entrega las páginas de `frontend/` |

El plan gratuito de Render no incluye MySQL; por eso la base va en Aiven.
Al final se obtiene un enlace como `https://sigea-xxxx.onrender.com` para la caja y el docente.

> El plan gratuito de Render "duerme" el servidor tras 15 minutos sin uso.
> La primera visita después de eso tarda unos 50 segundos en cargar; luego va normal.

---

## Paso 1. Crear la base MySQL en Aiven

1. Entrar a <https://console.aiven.io> y crear una cuenta (o entrar con GitHub).
2. **Create service → MySQL → Free plan**. Elegir una región cercana (por ejemplo, Estados Unidos) y crear.
3. Esperar a que el servicio diga **Running** (2 a 5 minutos).
4. En **Overview → Connection information** anotar: **Host**, **Port**, **User** (`avnadmin`) y **Password**.
5. En la misma sección, descargar el **CA certificate** (`ca.pem`).

## Paso 2. Cargar las tablas y los datos de prueba

En la carpeta `backend`, crear el archivo **`.env.nube`** (Git lo ignora, no se sube):

```env
DB_HOST=(host de Aiven)
DB_PORT=(puerto de Aiven)
DB_USER=avnadmin
DB_PASSWORD=(contraseña de Aiven)
DB_NAME=sigea_db
DB_SSL=true
DB_SSL_CA=(contenido de ca.pem en una sola línea, con \n en cada salto de línea)
```

Para convertir `ca.pem` a una sola línea en PowerShell:

```powershell
(Get-Content ca.pem) -join '\n'
```

Luego ejecutar:

```bash
npm run db:nube -- --si
```

Crea la base `sigea_db` en Aiven con `schema.sql` y `seed.sql` (incluye la tabla `alerta_salida` del Sprint 2).

## Paso 3. Publicar en Render

1. Entrar a <https://render.com> con la cuenta de GitHub **dueña del repositorio** (`pomavila/sigea`)
   o una que tenga acceso a él.
2. **New → Blueprint** y elegir el repositorio `sigea`. Render lee el archivo `render.yaml`.
3. Render pide los valores marcados como secretos. Copiar los mismos del archivo `.env.nube`:
   `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` y `DB_SSL_CA`.
   (`JWT_SECRET` lo genera Render solo.)
4. **Apply**. La primera publicación tarda unos 3 minutos. En **Logs** debe aparecer:

   ```text
   Conexión a MySQL exitosa
   SIGEA ejecutándose en puerto 10000
   ```

5. Abrir el enlace `https://sigea-xxxx.onrender.com` e iniciar sesión con los usuarios de prueba
   (contraseñas en `database/seed.sql`).

Render vuelve a publicar solo cada vez que se fusiona un pull request en la rama `develop`.

## Comprobar que todo funciona

- `https://sigea-xxxx.onrender.com/api/salud` responde `{"estado":"ok"}`.
- Iniciar sesión, abrir **Control de salida** y consultar la placa `CRT-001`: debe salir la alerta roja.

## Problemas frecuentes

| Mensaje en los Logs de Render | Causa y solución |
|-------------------------------|------------------|
| `Error al iniciar SIGEA: connect ETIMEDOUT` | Host o puerto mal copiados. Revisar `DB_HOST` y `DB_PORT`. |
| `self-signed certificate in certificate chain` | Falta `DB_SSL_CA` o está mal copiado (debe tener los `\n`). |
| `Access denied for user` | Usuario o contraseña de Aiven incorrectos. |
| `Unknown database 'sigea_db'` | Falta el Paso 2 (`npm run db:nube -- --si`). |

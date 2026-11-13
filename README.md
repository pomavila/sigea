
# SIGEA - Sistema de Gestión de Estacionamiento y Abonados

## 1. Información del proyecto

**Universidad:** Universidad Peruana Los Andes (UPLA)

**Escuela Profesional:** Ingeniería de Sistemas y Computación

**Ciclo:** V

**Empresa consultora:** Nexo Andino Consultores de TI S.A.C.

**Cliente:** UNICENTRO CAJAMARCA S.A.C.

**RUC del cliente:** 20486675978

**Metodología:** Scrum

**Versión:** 3.0 - Semana 10 (Noviembre 2026)

## 2. Descripción del proyecto

SIGEA (Sistema de Gestión de Estacionamiento y Abonados)
es una aplicación web desarrollada para mejorar la
administración del estacionamiento de la empresa
UNICENTRO CAJAMARCA S.A.C., ubicada en Huancayo.

El sistema permitirá gestionar información de abonados,
contratos, pagos y saldos pendientes, facilitando el
control administrativo y la consulta de información.

El proyecto se desarrolla utilizando la metodología Scrum,
mediante sprints e historias de usuario.

## 3. Integrantes

- Ramos Zamora, Michael Deivis
- Adauto Torpoco, Cristian Pedro
- Rivera Pecho, Jennifer Milagros
- Poma Vila, Nicolas André
- Taipe Sulla, Fernando Clevin

## 4. Tecnologías utilizadas

### Frontend
- HTML5
- CSS3
- JavaScript
- Bootstrap 5

### Backend
- Node.js 20
- Express.js
- API REST

### Base de datos
- MySQL 8
- mysql2

### Seguridad
- JWT (JSON Web Token), sesión de 8 horas
- bcrypt (contraseñas cifradas)
- Control de acceso por roles: CAJA, GERENCIA y OPERATIVO

### Control de versiones
- Git
- GitHub

## 5. Objetivo del proyecto

Desarrollar un sistema web que permita mejorar la
gestión de abonados, contratos y pagos del
estacionamiento UNICENTRO CAJAMARCA S.A.C.,
facilitando el control de los saldos pendientes
y la disponibilidad de información.

## 6. Sprint 1

**Periodo:** 09/11/2026 al 15/11/2026

**Objetivo del Sprint:**

Permitir que el personal de caja identifique
qué abonados se encuentran al día en sus pagos
y cuánto dinero tienen pendiente.

### Historias de usuario

**HU-01: Registro de abonados**

Permitir el registro y administración de la
información de los abonados del estacionamiento.

**HU-02: Pagos y saldos pendientes**

Permitir el registro de pagos y la consulta
de los saldos pendientes de los abonados.

## 7. Estructura del proyecto

```text
sigea/
|
|-- backend/
|   |-- src/
|   |   |-- config/        conexión a MySQL y configuración de seguridad
|   |   |-- controllers/   reciben la petición y devuelven la respuesta
|   |   |-- middlewares/   token JWT, roles, límite de intentos, errores
|   |   |-- models/        consultas SQL (únicos archivos que hablan con MySQL)
|   |   |-- routes/        rutas de la API REST
|   |   |-- services/      reglas de negocio RN-01 y RN-02 (estado y saldo)
|   |   |-- utils/         fechas y errores
|   |   |-- validators/    validación de datos (RN-03)
|   |
|   |-- scripts/           crear usuarios y reiniciar la base de datos
|   |-- tests/             pruebas automáticas (CP-01 a CP-10)
|   |-- app.js
|   |-- package.json
|   |-- .env.example
|
|-- frontend/
|   |-- css/
|   |   |-- styles.css             estilos comunes
|   |   |-- registro-abonado.css
|   |
|   |-- js/
|   |   |-- config.js              dirección de la API
|   |   |-- sigea.js               sesión, llamadas a la API y formato
|   |   |-- login.js
|   |   |-- panel.js
|   |   |-- abonados.js
|   |   |-- registro-abonado.js
|   |   |-- pagos.js
|   |
|   |-- pages/
|   |   |-- login.html             inicio de sesión
|   |   |-- abonados.html          listado con búsqueda y estado
|   |   |-- registro-abonado.html  registro de abonado y contrato
|   |   |-- pagos.html             estado de cuenta, pago e historial
|   |
|   |-- index.html                 panel de cobranza
|
|-- database/
|   |-- schema.sql
|   |-- seed.sql
|   |-- migrations/
|
|-- docs/
|   |-- API.md
|
|-- .github/
|   |-- pull_request_template.md
|
|-- .gitignore
|-- README.md
```

## 8. Requisitos para ejecutar el proyecto

Para ejecutar SIGEA localmente se necesita:

- Node.js 20
- npm
- MySQL 8 o servidor local compatible
- Git
- Navegador web
- Visual Studio Code (recomendado)

## 9. Instalación del proyecto

### Paso 1. Clonar el repositorio

```bash
git clone https://github.com/pomavila/sigea.git
```

### Paso 2. Ingresar a la carpeta backend

```bash
cd sigea/backend
```

### Paso 3. Instalar las dependencias

```bash
npm install
```

En PowerShell, si existe una restricción para
ejecutar npm, utilizar:

```powershell
npm.cmd install
```

### Paso 4. Configurar las variables de entorno

Crear un archivo `.env` dentro de `backend`,
tomando como referencia `.env.example`.

Ejemplo:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=sigea_db
JWT_SECRET=reemplazar_con_clave_segura
JWT_EXPIRES_IN=8h
```

Configurar los valores según el entorno local.
El secreto JWT debe reemplazarse por uno seguro
antes de implementar la autenticación.

El archivo `.env` no debe subirse a GitHub.

### Paso 5. Preparar la base de datos

**Opción A (recomendada).** Con MySQL encendido, desde la carpeta
`backend` ejecutar:

```bash
npm run db:reset
```

El comando crea la base `sigea_db` con sus tablas
(`database/schema.sql`) y los datos de prueba
(`database/seed.sql`). **Borra los datos que tuviera esa base**,
por eso pide confirmación.

**Opción B (manual).** En MySQL Workbench o phpMyAdmin ejecutar
`database/schema.sql` y luego `database/seed.sql`.

Si la base ya existía con el modelo anterior de T01, ejecutar una
sola vez `database/migrations/001_pago_anulacion.sql`.

### Paso 6. Ejecutar el backend

Desde la carpeta `backend`, ejecutar:

```bash
npm start
```

Si la conexión funciona correctamente,
el servidor mostrará mensajes similares a:

```text
Conexión a MySQL exitosa
SIGEA ejecutándose en puerto 3000
Abrir en el navegador: http://localhost:3000
```

Durante el desarrollo se puede usar `npm run dev`, que reinicia
el servidor cada vez que se guarda un archivo.

### Paso 7. Verificar la API REST

Abrir la siguiente dirección en el navegador:

http://localhost:3000/api/salud

Respuesta esperada:

```json
{
  "estado": "ok"
}
```

### Paso 8. Abrir el sistema

El mismo servidor entrega el frontend. Abrir en el navegador:

http://localhost:3000

Aparece la pantalla de inicio de sesión. Los usuarios de prueba
(`caja01` y `gerencia01`) y sus contraseñas están documentados al
inicio de `database/seed.sql`. Son solo para desarrollo.

Para crear otro usuario:

```bash
node scripts/crear-usuario.js
```

### Paso 9. Ejecutar las pruebas automáticas

Desde la carpeta `backend`:

```bash
npm test
```

Las pruebas cubren los casos CP-01 a CP-10 del Sprint 1. Usan una
base aparte llamada `sigea_test`, que se crea sola; no modifican
`sigea_db`.

## 10. Organización de ramas Git

El proyecto utiliza las siguientes ramas:

- `main`: código estable del proyecto.
- `develop`: integración de funcionalidades.
- `feature/T02-estructura-base`: estructura inicial.
- `feature/HU-01`: desarrollo del registro de abonados.
- `feature/HU-02`: desarrollo de pagos y saldos pendientes.

Las ramas de funcionalidades se integrarán
mediante Pull Requests hacia `develop`.

Se establece como política de trabajo solicitar
al menos una aprobación antes de integrar cambios.

## 11. Convención de commits

Se utilizarán mensajes descriptivos para
mantener organizado el historial del proyecto.

Ejemplos:

```text
feat(HU-01): agregar registro de abonados
feat(HU-02): implementar registro de pagos
fix(HU-02): corregir calculo de saldo
docs: actualizar documentacion del proyecto
chore: configurar estructura inicial de SIGEA
```

## 12. Pull Requests

Cada Pull Request debe incluir:

- Historia de usuario relacionada, si corresponde.
- Descripción de los cambios realizados.
- Evidencias de pruebas.
- Verificación de los criterios de aceptación.
- Lista de comprobación Definition of Done.
- Revisión de otro integrante del equipo.

La plantilla se encuentra en:

`.github/pull_request_template.md`

## 13. Seguridad y buenas prácticas

- No subir archivos `.env` al repositorio.
- Excluir `node_modules` mediante `.gitignore`.
- Utilizar variables de entorno para credenciales.
- Mantener separado el frontend del backend.
- Organizar el código por responsabilidades.
- Documentar los cambios realizados.
- Revisar los Pull Requests antes de integrarlos.

## 14. Estado actual del proyecto

**Sprint 1 - Abonados y cuentas por cobrar**

Funcionalidades implementadas:

**HU-01: Registro de abonados**

- Registro de abonado, vehículo y contrato en una sola transacción.
- Validación de DNI, celular y campos obligatorios (RN-03).
- Un espacio solo admite un contrato vigente (RN-04).
- Listado con búsqueda por nombre, apellido, DNI o placa.
- Estado de cada abonado: al día, por vencer o vencido (RN-01).

**HU-02: Pagos y saldos pendientes**

- Inicio de sesión con JWT de 8 horas y contraseñas con bcrypt (RN-06).
- Registro de pagos por meses, con periodo calculado por el sistema.
- Saldo pendiente = meses adeudados × tarifa mensual (RN-02).
- Historial de pagos del más reciente al más antiguo.
- Solo CAJA y GERENCIA registran pagos; solo GERENCIA anula (RN-05).

**Reglas de negocio**

| Regla | Descripción |
|-------|-------------|
| RN-01 | Al día: el periodo pagado vence en más de 5 días. Por vencer: vence en 0 a 5 días. Vencido: la fecha ya pasó. |
| RN-02 | Saldo pendiente = meses adeudados × tarifa mensual. |
| RN-03 | DNI de 8 dígitos; celular de 9 dígitos que empieza en 9; nombres, dirección, vehículo y espacio obligatorios. |
| RN-04 | Un espacio solo puede tener un contrato vigente. |
| RN-05 | CAJA y GERENCIA registran pagos; solo GERENCIA anula. |
| RN-06 | Contraseñas cifradas con bcrypt; la sesión expira a las 8 horas. |

La descripción de cada ruta de la API está en `docs/API.md`.

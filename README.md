
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
- Adauto Toropoco, Cristian Pedro
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
- JWT (JSON Web Token)
- bcrypt

### Control de versiones
- Git
- GitHub

**Nota:** JWT y bcrypt están contemplados para la
implementación posterior de la autenticación.

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
|   |   |-- config/
|   |   |-- controllers/
|   |   |-- middlewares/
|   |   |-- models/
|   |   |-- routes/
|   |
|   |-- app.js
|   |-- package.json
|   |-- package-lock.json
|   |-- .env.example
|
|-- frontend/
|   |-- css/
|   |   |-- styles.css
|   |
|   |-- js/
|   |   |-- app.js
|   |
|   |-- pages/
|   |   |-- abonados.html
|   |
|   |-- index.html
|
|-- database/
|   |-- schema.sql
|   |-- seed.sql
|
|-- docs/
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

1. Iniciar MySQL desde XAMPP o el servidor local.
2. Abrir phpMyAdmin.
3. Ejecutar el archivo `database/schema.sql`.
4. Verificar que exista la base de datos `sigea_db`.

El archivo `seed.sql` queda preparado para
incorporar datos iniciales posteriormente.

### Paso 6. Ejecutar el backend

Desde la carpeta `backend`, ejecutar:

```bash
node app.js
```

Si la conexión funciona correctamente,
el servidor mostrará mensajes similares a:

```text
Conexión a MySQL exitosa
SIGEA ejecutándose en puerto 3000
```

### Paso 7. Verificar la API REST

Abrir la siguiente dirección en el navegador:

http://localhost:3000/api/salud

Respuesta esperada:

```json
{
  "estado": "ok"
}
```

### Paso 8. Ejecutar el frontend

Abrir el archivo:

`frontend/index.html`

en un navegador web.

La página mostrará la interfaz inicial de SIGEA.

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

**Sprint 1 - Configuración inicial**

Componentes preparados:

- Repositorio Git y GitHub.
- Estructura inicial del frontend.
- Servidor backend con Express.
- Conexión inicial a MySQL.
- Endpoint de salud `/api/salud`.
- Archivos iniciales de base de datos.
- Plantilla de Pull Requests.
- Documentación inicial.

Las funcionalidades completas de HU-01 y HU-02
se desarrollarán en las siguientes tareas del Sprint.


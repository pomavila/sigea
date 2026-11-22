# API REST de SIGEA · Sprints 1 y 2

Todas las rutas empiezan con `/api`. En desarrollo: `http://localhost:3000/api`.

## Autenticación

Todas las rutas, salvo `/salud` y `/auth/login`, exigen el token JWT en la cabecera:

```text
Authorization: Bearer <token>
```

El token se obtiene en el inicio de sesión y dura 8 horas (RN-06).

## Formato de los errores

```json
{
  "mensaje": "El DNI debe tener 8 dígitos.",
  "errores": { "dni": "El DNI debe tener 8 dígitos." }
}
```

`errores` solo aparece cuando el problema es de un campo concreto.

| Código | Significado |
|--------|-------------|
| 400 | Datos inválidos |
| 401 | No inició sesión, o el token es inválido o venció |
| 403 | Su rol no tiene permiso |
| 404 | El recurso no existe |
| 409 | Choca con un dato existente (DNI, placa, espacio ocupado, operación repetida) |
| 429 | Demasiados intentos fallidos de inicio de sesión |

## Rutas

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| GET | `/salud` | público | Comprueba que el servidor responde |
| POST | `/auth/login` | público | Inicia sesión y devuelve el token |
| GET | `/auth/perfil` | con sesión | Datos del usuario del token |
| GET | `/auth/prueba-gerencia` | GERENCIA | Ruta de prueba del control por roles |
| GET | `/resumen` | con sesión | Indicadores del panel |
| GET | `/espacios?tipo=&estado=` | con sesión | Espacios, con filtros opcionales |
| GET | `/abonados?buscar=&estado=` | con sesión | Listado con estado y saldo |
| GET | `/abonados/:id` | con sesión | Detalle de un abonado y sus contratos |
| POST | `/abonados` | CAJA, GERENCIA | Registra abonado, vehículo y contrato |
| PUT | `/abonados/:id` | CAJA, GERENCIA | Edita los datos personales |
| GET | `/abonados/:id/estado` | con sesión | Estado según RN-01 |
| GET | `/abonados/:id/saldo` | con sesión | Saldo según RN-02 |
| GET | `/abonados/:id/pagos` | con sesión | Estado de cuenta e historial de pagos |
| POST | `/pagos` | CAJA, GERENCIA | Registra un pago |
| POST | `/pagos/:id/anular` | GERENCIA | Anula un pago |
| GET | `/salida/verificar?placa=` | con sesión | Sprint 2 · HU-03: consulta la deuda de una placa sin registrar nada |
| POST | `/salida` | con sesión | Sprint 2 · HU-03: consulta la placa y registra la alerta (RN-07) |
| GET | `/alertas?fecha=` | con sesión | Sprint 2 · HU-03: historial de alertas del día con totales |
| GET | `/caja/cuadre?fecha=` | CAJA, GERENCIA | Sprint 2 · HU-04: total cobrado en el día por medio de pago |
| GET | `/pagos/:id/comprobante` | con sesión | Sprint 2 · HU-05: comprobante del pago en PDF (RN-09) |
| GET | `/pagos/:id/whatsapp` | con sesión | Sprint 2 · HU-05: enlace de WhatsApp con los datos del comprobante |

## Ejemplos

### POST /auth/login

```json
{ "usuario": "caja01", "contrasena": "(ver database/seed.sql)" }
```

Respuesta 200:

```json
{
  "mensaje": "Inicio de sesión exitoso",
  "token": "eyJhbGciOi...",
  "tipo": "Bearer",
  "expira_en": "8h",
  "usuario": { "id_usuario": 1, "nombre": "Cajero de Turno", "usuario": "caja01", "rol": "CAJA" }
}
```

### POST /abonados

Los tres bloques se guardan en una sola transacción: si uno falla, no se guarda ninguno.

```json
{
  "abonado": {
    "nombres": "María José",
    "apellidos": "Ñahui Pérez",
    "dni": "45678912",
    "direccion": "Jr. Cajamarca 344, Huancayo",
    "celular": "912345678"
  },
  "vehiculo": { "tipo": "CARRO", "placa_codigo": "W1X-234", "descripcion": "Nissan Sentra negro" },
  "contrato": { "id_espacio": 8, "tarifa_mensual": 180, "fecha_inicio": "2026-11-12", "fecha_fin": "2027-11-12" }
}
```

- `vehiculo.tipo`: `CARRO`, `MOTO` o `CARRETA`.
- Respuesta 201: el abonado con sus contratos (igual que `GET /abonados/:id`).
- 409 si el DNI o la placa ya existen, o si el espacio está ocupado (RN-04).

### GET /abonados

Cada elemento es un contrato vigente:

```json
{
  "id_abonado": 3,
  "nombres": "Carlos",
  "apellidos": "Ccora Landa",
  "dni": "70345678",
  "id_contrato": 3,
  "tarifa_mensual": 60,
  "fecha_inicio": "2026-06-12",
  "fecha_fin": "2027-06-12",
  "vehiculo": { "tipo": "MOTO", "placa_codigo": "4521-MT", "descripcion": "Honda XR150 roja" },
  "espacio": { "id_espacio": 6, "codigo": "E-02", "tipo": "EXTERIOR" },
  "pagado_hasta": "2026-09-28",
  "estado": "VENCIDO",
  "dias_para_vencer": -45,
  "meses_adeudados": 2,
  "saldo_pendiente": 120,
  "proximo_periodo_desde": "2026-09-29",
  "contrato_finalizado": false
}
```

- `estado`: `AL_DIA`, `POR_VENCER` o `VENCIDO` (RN-01).
- `buscar` compara con nombres, apellidos, DNI y placa, sin distinguir tildes ni mayúsculas.

### POST /pagos

```json
{ "id_contrato": 3, "meses": 2, "monto": 120, "medio_pago": "YAPE", "nro_operacion": "YP-445566" }
```

- `meses`: de 1 a 12. El periodo lo calcula el servidor: empieza el día siguiente
  al último periodo pagado, o en la fecha de inicio del contrato si aún no hay pagos.
- `monto`: debe ser igual a `meses × tarifa_mensual`. Un monto de 0 o negativo se rechaza.
- `medio_pago`: `EFECTIVO`, `YAPE`, `PLIN` o `TRANSFERENCIA`.
- `nro_operacion`: opcional; no se puede repetir en otro pago.
- Respuesta 201: `{ "pago": {...}, "abonado": {...} }` con el estado y el saldo actualizados.

### POST /pagos/:id/anular

```json
{ "motivo": "Se registró al abonado equivocado" }
```

- Solo GERENCIA (RN-05). Un usuario CAJA recibe 403.
- El pago no se borra: queda con estado `ANULADO`, quién lo anuló, cuándo y el motivo.
- Solo se puede anular el último pago del contrato.

### GET /salida/verificar?placa=CRT-001 (Sprint 2 · HU-03)

`resultado` puede ser `CON_DEUDA` (alerta roja), `AL_DIA` (salida permitida) o `NO_ABONADO` (cliente por hora).
La placa se reconoce con o sin guion y en minúsculas.

```json
{
  "placa": "CRT-001",
  "resultado": "CON_DEUDA",
  "mensaje": "Abonado con deuda: cobrar antes de permitir la salida.",
  "abonado": { "id_abonado": 4, "nombres": "Marleny", "apellidos": "Paucar Salazar", "dni": "70456789", "celular": "999888777" },
  "vehiculo": { "id_vehiculo": 4, "tipo": "CARRETA", "placa_codigo": "CRT-001", "descripcion": "Carreta de carga liviana" },
  "espacio": { "id_espacio": 7, "codigo": "E-03", "tipo": "EXTERIOR" },
  "id_contrato": 4,
  "estado": "VENCIDO",
  "meses_adeudados": 1,
  "saldo_pendiente": 250
}
```

### POST /salida (Sprint 2 · HU-03)

```json
{ "placa": "CRT-001" }
```

Responde `201` con lo mismo que `/salida/verificar` más `id_alerta` y `fecha_hora` (hora de Huancayo).

### GET /caja/cuadre?fecha=2026-11-21 (Sprint 2 · HU-04)

```json
{
  "fecha": "2026-11-21",
  "cantidad": 2,
  "total": 350,
  "por_medio": [
    { "medio": "EFECTIVO", "cantidad": 1, "total": 200 },
    { "medio": "YAPE", "cantidad": 0, "total": 0 },
    { "medio": "PLIN", "cantidad": 1, "total": 150 },
    { "medio": "TRANSFERENCIA", "cantidad": 0, "total": 0 }
  ],
  "anulados": { "cantidad": 0, "total": 0 },
  "pagos": [ "…detalle de cada pago…" ]
}
```

### GET /pagos/:id/comprobante (Sprint 2 · HU-05)

Responde el PDF (`Content-Type: application/pdf`) con el número correlativo `C001-000001`.
Cada pago genera su comprobante al registrarse (RN-09); si el pago se anula, el PDF sale marcado como **ANULADO**.

### GET /pagos/:id/whatsapp (Sprint 2 · HU-05)

```json
{ "comprobante": "C001-000005", "celular": "9XXXXXXXX", "mensaje": "Hola, …", "url": "https://wa.me/519XXXXXXXX?text=…" }
```

Responde `409` si el abonado no tiene celular registrado.


/* =========================================================
   SIGEA · Rutas de la API REST (todas empiezan con /api)

   Método  Ruta                        Rol que puede usarla
   ------  --------------------------  ---------------------------
   GET     /salud                      público
   POST    /auth/login                 público
   GET     /auth/perfil                cualquier usuario con sesión
   GET     /resumen                    cualquier usuario con sesión
   GET     /espacios                   cualquier usuario con sesión
   GET     /abonados                   cualquier usuario con sesión
   GET     /abonados/:id               cualquier usuario con sesión
   GET     /abonados/:id/estado        cualquier usuario con sesión
   GET     /abonados/:id/saldo         cualquier usuario con sesión
   GET     /abonados/:id/pagos         cualquier usuario con sesión
   POST    /abonados                   CAJA, GERENCIA
   PUT     /abonados/:id               CAJA, GERENCIA
   POST    /pagos                      CAJA, GERENCIA   (RN-05)
   POST    /pagos/:id/anular           GERENCIA         (RN-05)
   ========================================================= */

'use strict';

const { Router } = require('express');
const { verificarToken, permitirRoles } = require('../middlewares/auth');
const { revisarBloqueo } = require('../middlewares/limiteLogin');
const { ROLES } = require('../config/seguridad');
const authController = require('../controllers/auth.controller');
const abonadoController = require('../controllers/abonado.controller');
const pagoController = require('../controllers/pago.controller');

const router = Router();

// ---------- Rutas públicas ----------
router.get('/salud', (req, res) => {
  res.status(200).json({ estado: 'ok' });
});
router.post('/auth/login', revisarBloqueo, authController.login);

// ---------- Desde aquí todo exige haber iniciado sesión ----------
router.use(verificarToken);

router.get('/auth/perfil', authController.perfil);
router.get('/resumen', abonadoController.resumen);
router.get('/espacios', abonadoController.listarEspacios);

// Roles que pueden registrar o modificar información
const puedeEscribir = permitirRoles(ROLES.CAJA, ROLES.GERENCIA);

// HU-01 · Abonados
router.get('/abonados', abonadoController.listar);
router.post('/abonados', puedeEscribir, abonadoController.crear);
router.get('/abonados/:id', abonadoController.obtener);
router.put('/abonados/:id', puedeEscribir, abonadoController.actualizar);
router.get('/abonados/:id/estado', abonadoController.estado);

// HU-02 · Pagos y saldo
router.get('/abonados/:id/pagos', pagoController.historial);
router.get('/abonados/:id/saldo', pagoController.saldo);
router.post('/pagos', puedeEscribir, pagoController.registrar);
router.post('/pagos/:id/anular', permitirRoles(ROLES.GERENCIA), pagoController.anular);

module.exports = router;

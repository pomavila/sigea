-- =====================================================================
-- SIGEA - Datos de prueba | Sprint 1 | Tarea T01
-- Archivo: database/seed.sql
-- Ejecutar DESPUÉS de schema.sql
-- =====================================================================
-- Las fechas son RELATIVAS a CURDATE(), así los estados de RN-01
-- (Al día / Por vencer / Vencido) siguen siendo válidos el día que
-- ejecutes el script o hagas la sustentación.
--
-- Contraseñas de prueba (solo desarrollo, cambiarlas en producción):
--   caja01     -> Caja2026!
--   gerencia01 -> Gerencia2026!
-- Los hashes son bcrypt reales (costo 12).
-- =====================================================================

USE sigea_db;

-- ---------------------------------------------------------------------
-- 1. USUARIOS (uno CAJA y uno GERENCIA)
-- ---------------------------------------------------------------------
INSERT INTO usuario (id_usuario, nombre, usuario, contrasena_hash, rol, activo) VALUES
(1, 'Cajero de Turno',    'caja01',
    '$2b$12$y7k17.wx0N7T2J/wHZ.KPuolcMnt1nyrMQZZsTfNVwS136TLUMk.i', 'CAJA', 1),
(2, 'Gerente General',    'gerencia01',
    '$2b$12$7Mi47w7k1l4w/AEhN7yIFeGJ1RFHZatoi4q.NdWUZPAm7u5d.A5pK', 'GERENCIA', 1);

-- ---------------------------------------------------------------------
-- 2. ESPACIOS (4 techados, 5 exteriores, 1 almacén)
--    Quedan OCUPADOS los 5 que usan los contratos de abajo.
-- ---------------------------------------------------------------------
INSERT INTO espacio (id_espacio, codigo, tipo, estado) VALUES
(1,  'T-01', 'TECHADO',  'OCUPADO'),
(2,  'T-02', 'TECHADO',  'OCUPADO'),
(3,  'T-03', 'TECHADO',  'LIBRE'),
(4,  'T-04', 'TECHADO',  'LIBRE'),
(5,  'E-01', 'EXTERIOR', 'OCUPADO'),
(6,  'E-02', 'EXTERIOR', 'OCUPADO'),
(7,  'E-03', 'EXTERIOR', 'OCUPADO'),
(8,  'E-04', 'EXTERIOR', 'LIBRE'),
(9,  'E-05', 'EXTERIOR', 'LIBRE'),
(10, 'A-01', 'ALMACEN',  'LIBRE');

-- ---------------------------------------------------------------------
-- 3. ABONADOS 
-- ---------------------------------------------------------------------
INSERT INTO abonado (id_abonado, nombres, apellidos, dni, direccion, celular) VALUES
(1, 'Rosa Elena',   'Quispe Mamani',  '70123456', 'Jr. Real 345, Huancayo',           '987654321'),
(2, 'Luis Alberto', 'Huamán Rojas',   '70234567', 'Av. Giráldez 782, Huancayo',       '964321789'),
(3, 'Carlos',       'Ccora Landa',    '70345678', 'Calle Ancash 120, El Tambo',       '951234567'),
(4, 'Marleny',      'Paucar Salazar', '70456789', 'Psje. Los Andes 56, Chilca',       '999888777'),
(5, 'Julio César',  'Rivera Córdova', '70567890', 'Av. Mariscal Castilla 1450, El Tambo', NULL);

-- ---------------------------------------------------------------------
-- 4. VEHÍCULOS (uno por abonado)
-- ---------------------------------------------------------------------
INSERT INTO vehiculo (id_vehiculo, id_abonado, tipo, placa_codigo, descripcion) VALUES
(1, 1, 'CARRO',   'V4K-812', 'Toyota Yaris blanco'),
(2, 2, 'CARRO',   'B7P-305', 'Hyundai Accent gris'),
(3, 3, 'MOTO',    '4521-MT', 'Honda XR150 roja'),
(4, 4, 'CARRETA', 'CRT-001', 'Carreta de carga liviana'),
(5, 5, 'CARRO',   'A9X-640', 'Kia Rio azul');

-- ---------------------------------------------------------------------
-- 5. CONTRATOS (todos VIGENTES; un espacio distinto por contrato -> RN-04)
--    Las tarifas son valores de ejemplo, ajústalas con el cliente.
-- ---------------------------------------------------------------------
INSERT INTO contrato
    (id_contrato, id_abonado, id_vehiculo, id_espacio, tarifa_mensual, fecha_inicio, fecha_fin, estado)
VALUES
(1, 1, 1, 1, 200.00, DATE_SUB(CURDATE(), INTERVAL 3 MONTH), DATE_ADD(CURDATE(), INTERVAL 9 MONTH),  'VIGENTE'),
(2, 2, 2, 5, 150.00, DATE_SUB(CURDATE(), INTERVAL 4 MONTH), DATE_ADD(CURDATE(), INTERVAL 8 MONTH),  'VIGENTE'),
(3, 3, 3, 6,  60.00, DATE_SUB(CURDATE(), INTERVAL 5 MONTH), DATE_ADD(CURDATE(), INTERVAL 7 MONTH),  'VIGENTE'),
(4, 4, 4, 7, 250.00, DATE_SUB(CURDATE(), INTERVAL 10 DAY),  DATE_ADD(CURDATE(), INTERVAL 12 MONTH), 'VIGENTE'),
(5, 5, 5, 2, 200.00, CURDATE(),                             DATE_ADD(CURDATE(), INTERVAL 12 MONTH), 'VIGENTE');

-- ---------------------------------------------------------------------
-- 6. PAGOS (3 pagos -> definen el estado RN-01 de los abonados 1, 2 y 3)
--    Abonado 1 (Rosa)   : periodo_hasta = hoy + 20 días -> AL DÍA     (> 5 días)
--    Abonado 2 (Luis)   : periodo_hasta = hoy + 3 días  -> POR VENCER (0 a 5 días)
--    Abonado 3 (Carlos) : periodo_hasta = hoy - 45 días -> VENCIDO    (fecha ya pasó)
--    Abonados 4 y 5     : sin pagos (caso borde para probar la API)
-- ---------------------------------------------------------------------
INSERT INTO pago
    (id_pago, id_contrato, fecha_pago, monto, periodo_desde, periodo_hasta, medio_pago, nro_operacion, id_usuario)
VALUES
(1, 1, DATE_SUB(NOW(), INTERVAL 10 DAY), 200.00,
    DATE_SUB(CURDATE(), INTERVAL 10 DAY), DATE_ADD(CURDATE(), INTERVAL 20 DAY),
    'YAPE', '00123456', 1),
(2, 2, DATE_SUB(NOW(), INTERVAL 27 DAY), 150.00,
    DATE_SUB(CURDATE(), INTERVAL 27 DAY), DATE_ADD(CURDATE(), INTERVAL 3 DAY),
    'EFECTIVO', NULL, 1),
(3, 3, DATE_SUB(NOW(), INTERVAL 75 DAY),  60.00,
    DATE_SUB(CURDATE(), INTERVAL 75 DAY), DATE_SUB(CURDATE(), INTERVAL 45 DAY),
    'TRANSFERENCIA', '8847731', 2);

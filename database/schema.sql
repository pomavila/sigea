-- =====================================================================
-- SIGEA - Sistema de Gestión de Estacionamiento (UNICENTRO CAJAMARCA S.A.C.)
-- Sprint 1 | Tarea T01: Modelo de datos | MySQL 8.0.16 o superior
-- Archivo: database/schema.sql
-- =====================================================================
-- Requisito: MySQL 8.0.16+ (desde esa versión se hacen cumplir los CHECK).
-- Orden de creación: primero las tablas "padre" y luego las que tienen FK.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS sigea_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;

USE sigea_db;

-- ---------------------------------------------------------------------
-- 1. USUARIO  (RN-05: roles | RN-06: contraseña cifrada con bcrypt)
-- ---------------------------------------------------------------------
CREATE TABLE usuario (
    id_usuario       INT UNSIGNED NOT NULL AUTO_INCREMENT,
    nombre           VARCHAR(100) NOT NULL,
    usuario          VARCHAR(30)  NOT NULL,
    contrasena_hash  VARCHAR(100) NOT NULL,          -- bcrypt genera 60 caracteres
    rol              ENUM('CAJA','GERENCIA','OPERATIVO') NOT NULL,
    activo           TINYINT(1)   NOT NULL DEFAULT 1, -- 1 = activo, 0 = inactivo
    CONSTRAINT pk_usuario        PRIMARY KEY (id_usuario),
    CONSTRAINT uq_usuario_usuario UNIQUE (usuario),
    CONSTRAINT ck_usuario_activo CHECK (activo IN (0, 1))
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. ABONADO  (RN-03: DNI de 8 dígitos; celular de 9 dígitos que empieza en 9)
-- ---------------------------------------------------------------------
CREATE TABLE abonado (
    id_abonado      INT UNSIGNED NOT NULL AUTO_INCREMENT,
    nombres         VARCHAR(100) NOT NULL,
    apellidos       VARCHAR(100) NOT NULL,
    dni             CHAR(8)      NOT NULL,
    direccion       VARCHAR(150) NOT NULL,
    celular         CHAR(9)      NULL,                -- opcional, pero si se envía debe ser válido
    fecha_registro  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_abonado      PRIMARY KEY (id_abonado),
    CONSTRAINT uq_abonado_dni  UNIQUE (dni),
    CONSTRAINT ck_abonado_dni      CHECK (dni REGEXP '^[0-9]{8}$'),
    CONSTRAINT ck_abonado_celular  CHECK (celular IS NULL OR celular REGEXP '^9[0-9]{8}$')
) ENGINE=InnoDB;

-- Búsqueda de abonados por apellidos/nombres desde la pantalla de caja
CREATE INDEX idx_abonado_apellidos ON abonado (apellidos, nombres);

-- ---------------------------------------------------------------------
-- 3. VEHICULO  (un abonado puede tener varios vehículos)
-- ---------------------------------------------------------------------
CREATE TABLE vehiculo (
    id_vehiculo   INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_abonado    INT UNSIGNED NOT NULL,
    tipo          ENUM('CARRO','MOTO','CARRETA') NOT NULL,
    placa_codigo  VARCHAR(15)  NOT NULL,              -- placa (carro/moto) o código (carreta)
    descripcion   VARCHAR(100) NULL,
    CONSTRAINT pk_vehiculo        PRIMARY KEY (id_vehiculo),
    CONSTRAINT uq_vehiculo_placa  UNIQUE (placa_codigo),
    CONSTRAINT fk_vehiculo_abonado FOREIGN KEY (id_abonado)
        REFERENCES abonado (id_abonado)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;
-- MySQL crea automáticamente un índice sobre id_abonado por la FK.

-- ---------------------------------------------------------------------
-- 4. ESPACIO
-- ---------------------------------------------------------------------
CREATE TABLE espacio (
    id_espacio  INT UNSIGNED NOT NULL AUTO_INCREMENT,
    codigo      VARCHAR(10)  NOT NULL,                -- ej.: T-01, E-03, A-01
    tipo        ENUM('TECHADO','EXTERIOR','ALMACEN') NOT NULL,
    estado      ENUM('LIBRE','OCUPADO') NOT NULL DEFAULT 'LIBRE',
    CONSTRAINT pk_espacio         PRIMARY KEY (id_espacio),
    CONSTRAINT uq_espacio_codigo  UNIQUE (codigo)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. CONTRATO  (RN-04: un espacio solo puede tener un contrato VIGENTE)
-- ---------------------------------------------------------------------
CREATE TABLE contrato (
    id_contrato     INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    id_abonado      INT UNSIGNED  NOT NULL,
    id_vehiculo     INT UNSIGNED  NOT NULL,
    id_espacio      INT UNSIGNED  NOT NULL,
    tarifa_mensual  DECIMAL(8,2)  NOT NULL,
    fecha_inicio    DATE          NOT NULL,
    fecha_fin       DATE          NOT NULL,           -- fecha de vencimiento del contrato
    estado          ENUM('VIGENTE','VENCIDO','ANULADO') NOT NULL DEFAULT 'VIGENTE',

    -- Columna generada: guarda id_espacio SOLO si el contrato está VIGENTE;
    -- en cualquier otro estado vale NULL. (Base de la garantía de RN-04.)
    id_espacio_vigente INT UNSIGNED
        GENERATED ALWAYS AS (CASE WHEN estado = 'VIGENTE' THEN id_espacio ELSE NULL END) STORED,

    CONSTRAINT pk_contrato PRIMARY KEY (id_contrato),

    -- RN-04: UNIQUE permite varios NULL, pero no dos valores iguales.
    -- Resultado: no puede haber dos contratos VIGENTES en el mismo espacio.
    CONSTRAINT uq_contrato_espacio_vigente UNIQUE (id_espacio_vigente),

    CONSTRAINT ck_contrato_tarifa  CHECK (tarifa_mensual > 0),
    CONSTRAINT ck_contrato_fechas  CHECK (fecha_fin > fecha_inicio),

    -- RESTRICT (y no CASCADE): MySQL no permite CASCADE en columnas base de una columna generada.
    CONSTRAINT fk_contrato_abonado  FOREIGN KEY (id_abonado)  REFERENCES abonado  (id_abonado)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_contrato_vehiculo FOREIGN KEY (id_vehiculo) REFERENCES vehiculo (id_vehiculo)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_contrato_espacio  FOREIGN KEY (id_espacio)  REFERENCES espacio  (id_espacio)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

-- Listados por estado y próximos vencimientos
CREATE INDEX idx_contrato_estado_fin ON contrato (estado, fecha_fin);
-- Contratos de un abonado (ya existe índice por la FK id_abonado; este es para consultas combinadas)
CREATE INDEX idx_contrato_abonado_estado ON contrato (id_abonado, estado);

-- ---------------------------------------------------------------------
-- 6. PAGO  (RN-02 y RN-05)
-- ---------------------------------------------------------------------
CREATE TABLE pago (
    id_pago        INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    id_contrato    INT UNSIGNED  NOT NULL,
    fecha_pago     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    monto          DECIMAL(8,2)  NOT NULL,
    periodo_desde  DATE          NOT NULL,
    periodo_hasta  DATE          NOT NULL,
    medio_pago     ENUM('EFECTIVO','YAPE','PLIN','TRANSFERENCIA') NOT NULL,
    nro_operacion  VARCHAR(30)   NULL,                -- NULL en efectivo; único si existe
    id_usuario     INT UNSIGNED  NOT NULL,            -- quién registró el pago

    -- RN-05: un pago no se borra, se ANULA (solo GERENCIA) y queda el rastro.
    estado            ENUM('REGISTRADO','ANULADO') NOT NULL DEFAULT 'REGISTRADO',
    anulado_por       INT UNSIGNED  NULL,             -- usuario GERENCIA que anuló
    fecha_anulacion   DATETIME      NULL,
    motivo_anulacion  VARCHAR(200)  NULL,

    CONSTRAINT pk_pago PRIMARY KEY (id_pago),
    CONSTRAINT uq_pago_nro_operacion UNIQUE (nro_operacion),  -- MySQL permite varios NULL
    CONSTRAINT ck_pago_monto    CHECK (monto > 0),
    CONSTRAINT ck_pago_periodo  CHECK (periodo_hasta >= periodo_desde),
    CONSTRAINT fk_pago_contrato FOREIGN KEY (id_contrato) REFERENCES contrato (id_contrato)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_pago_usuario  FOREIGN KEY (id_usuario)  REFERENCES usuario  (id_usuario)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_pago_anulado_por FOREIGN KEY (anulado_por) REFERENCES usuario (id_usuario)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Consulta clave de RN-01 y RN-02: "último periodo pagado de un contrato"
-- (MAX(periodo_hasta) por id_contrato) se resuelve solo con este índice.
CREATE INDEX idx_pago_contrato_periodo ON pago (id_contrato, periodo_hasta);
-- Reportes de caja por fecha
CREATE INDEX idx_pago_fecha ON pago (fecha_pago);

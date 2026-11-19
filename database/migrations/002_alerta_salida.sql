-- =====================================================================
-- SIGEA - Migración 002 | Sprint 2 | HU-03 (T13)
-- Archivo: database/migrations/002_alerta_salida.sql
-- =====================================================================
-- ¿Para qué sirve?
--   Si YA tienes la base sigea_db del Sprint 1 con datos que quieres
--   conservar, ejecuta este archivo UNA sola vez para agregar la tabla
--   alerta_salida (RN-07). No borra ni cambia ningún dato.
--
--   Si vas a crear la base desde cero NO lo necesitas: schema.sql ya
--   incluye la tabla. También puedes usar:  npm run db:reset
-- =====================================================================

USE sigea_db;

CREATE TABLE IF NOT EXISTS alerta_salida (
    id_alerta        INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    placa            VARCHAR(15)   NOT NULL,
    id_contrato      INT UNSIGNED  NULL,
    saldo_detectado  DECIMAL(8,2)  NOT NULL DEFAULT 0,
    resultado        ENUM('CON_DEUDA','AL_DIA','NO_ABONADO') NOT NULL,
    fecha_hora       DATETIME      NOT NULL,
    id_usuario       INT UNSIGNED  NOT NULL,
    CONSTRAINT pk_alerta_salida PRIMARY KEY (id_alerta),
    CONSTRAINT ck_alerta_saldo  CHECK (saldo_detectado >= 0),
    CONSTRAINT fk_alerta_contrato FOREIGN KEY (id_contrato) REFERENCES contrato (id_contrato)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_alerta_usuario  FOREIGN KEY (id_usuario)  REFERENCES usuario  (id_usuario)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_alerta_fecha (fecha_hora)
) ENGINE=InnoDB;

-- =====================================================================
-- SIGEA - Migración 001 | Sprint 1 | HU-02 (T09)
-- Archivo: database/migrations/001_pago_anulacion.sql
-- =====================================================================
-- ¿Para qué sirve?
--   Si YA creaste la base sigea_db con el schema.sql anterior (T01),
--   ejecuta este archivo UNA sola vez para agregar a la tabla pago las
--   columnas que permiten ANULAR un pago sin borrarlo (RN-05).
--
--   Si vas a crear la base desde cero NO lo necesitas: schema.sql ya
--   incluye estas columnas. También puedes usar:  npm run db:reset
-- =====================================================================

USE sigea_db;

ALTER TABLE pago
    ADD COLUMN estado            ENUM('REGISTRADO','ANULADO') NOT NULL DEFAULT 'REGISTRADO',
    ADD COLUMN anulado_por       INT UNSIGNED  NULL,
    ADD COLUMN fecha_anulacion   DATETIME      NULL,
    ADD COLUMN motivo_anulacion  VARCHAR(200)  NULL,
    ADD CONSTRAINT fk_pago_anulado_por FOREIGN KEY (anulado_por)
        REFERENCES usuario (id_usuario)
        ON DELETE RESTRICT ON UPDATE CASCADE;

-- =====================================================================
-- SIGEA - Migración 003 | Sprint 2 | HU-05 (T21)
-- Archivo: database/migrations/003_comprobante.sql
-- =====================================================================
-- ¿Para qué sirve?
--   Si YA tienes la base sigea_db con datos, ejecuta este archivo UNA sola
--   vez: crea la tabla comprobante (RN-09) y emite un comprobante para
--   cada pago que ya existe, en el orden en que se registraron.
--   No borra ni cambia ningún pago.
--
--   Si vas a crear la base desde cero NO lo necesitas: usa npm run db:reset
-- =====================================================================

USE sigea_db;

-- ---------------------------------------------------------------------
-- 8. COMPROBANTE  (Sprint 2 · HU-05 · T21 · RN-09)
--    Cada pago genera un comprobante interno con numeración correlativa
--    (serie C001). No se edita: si el pago se anula, queda ANULADO.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comprobante (
    id_comprobante  INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    id_pago         INT UNSIGNED  NOT NULL,
    serie           CHAR(4)       NOT NULL DEFAULT 'C001',
    numero          INT UNSIGNED  NOT NULL,           -- correlativo dentro de la serie
    fecha_emision   DATETIME      NOT NULL,
    estado          ENUM('EMITIDO','ANULADO') NOT NULL DEFAULT 'EMITIDO',
    CONSTRAINT pk_comprobante PRIMARY KEY (id_comprobante),
    CONSTRAINT uq_comprobante_pago UNIQUE (id_pago),           -- 1 pago = 1 comprobante
    CONSTRAINT uq_comprobante_numero UNIQUE (serie, numero),   -- sin números repetidos
    CONSTRAINT fk_comprobante_pago FOREIGN KEY (id_pago) REFERENCES pago (id_pago)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

INSERT INTO comprobante (id_pago, serie, numero, fecha_emision, estado)
SELECT p.id_pago, 'C001',
       ROW_NUMBER() OVER (ORDER BY p.id_pago),
       p.fecha_pago,
       IF(p.estado = 'ANULADO', 'ANULADO', 'EMITIDO')
  FROM pago p
 WHERE NOT EXISTS (SELECT 1 FROM comprobante c WHERE c.id_pago = p.id_pago);

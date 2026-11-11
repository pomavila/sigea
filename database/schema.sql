
-- SIGEA
-- Sistema de Gestión de Estacionamiento
-- Sprint 1: 09/11/2026 al 15/11/2026
-- Base de datos: sigea_db

CREATE DATABASE IF NOT EXISTS sigea_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE sigea_db;

-- Las tablas de abonados, contratos,
-- espacios y pagos se implementarán
-- durante las historias HU-01 y HU-02.

-- ==========================================
-- T08: Autenticación y roles de usuarios
-- ==========================================

CREATE TABLE IF NOT EXISTS usuario (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    usuario VARCHAR(50) NOT NULL UNIQUE,
    contrasena_hash VARCHAR(255) NOT NULL,
    rol ENUM('CAJA', 'GERENCIA', 'OPERATIVO') NOT NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1
);

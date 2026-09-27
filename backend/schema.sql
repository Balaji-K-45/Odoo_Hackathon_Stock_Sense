-- ============================================================
-- StockSense Database Schema — MySQL 8.0
-- Run this once to create the database and all tables.
-- ============================================================

CREATE DATABASE IF NOT EXISTS stocksense
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE stocksense;

-- ── Users ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            INT          NOT NULL AUTO_INCREMENT,
    name          VARCHAR(120) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('INVENTORY_MANAGER','WAREHOUSE_STAFF') NOT NULL DEFAULT 'WAREHOUSE_STAFF',
    email_verified TINYINT(1) NOT NULL DEFAULT 1,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ── Categories ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
    id         INT          NOT NULL AUTO_INCREMENT,
    name       VARCHAR(100) NOT NULL UNIQUE,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ── Warehouses ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouses (
    id         INT          NOT NULL AUTO_INCREMENT,
    name       VARCHAR(150) NOT NULL UNIQUE,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ── Locations (belong to a warehouse) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS locations (
    id           INT          NOT NULL AUTO_INCREMENT,
    warehouse_id INT          NOT NULL,
    name         VARCHAR(150) NOT NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_location_name (warehouse_id, name),
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
) ENGINE=InnoDB;

-- ── Products ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
    id            INT          NOT NULL AUTO_INCREMENT,
    name          VARCHAR(200) NOT NULL,
    sku           VARCHAR(100) NOT NULL UNIQUE,
    category_id   INT,
    uom           VARCHAR(50)  NOT NULL DEFAULT 'units',
    reorder_level DECIMAL(12,4) NOT NULL DEFAULT 0,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                               ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
) ENGINE=InnoDB;

-- ── Stock (quantity per product per location) ──────────────────────────────
CREATE TABLE IF NOT EXISTS stock (
    id          INT           NOT NULL AUTO_INCREMENT,
    product_id  INT           NOT NULL,
    location_id INT           NOT NULL,
    quantity    DECIMAL(12,4) NOT NULL DEFAULT 0,
    updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_product_location (product_id, location_id),
    FOREIGN KEY (product_id)  REFERENCES products(id),
    FOREIGN KEY (location_id) REFERENCES locations(id)
) ENGINE=InnoDB;

-- ── Operations (one row per receipt / delivery / transfer / adjustment) ────
CREATE TABLE IF NOT EXISTS operations (
    id             INT          NOT NULL AUTO_INCREMENT,
    operation_type ENUM('RECEIPT','DELIVERY','TRANSFER','ADJUSTMENT') NOT NULL,
    status         VARCHAR(20)  NOT NULL DEFAULT 'done',
    reference      VARCHAR(100),
    notes          TEXT,
    user_id        INT,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- ── Operation Items (line items inside an operation) ──────────────────────
CREATE TABLE IF NOT EXISTS operation_items (
    id                      INT           NOT NULL AUTO_INCREMENT,
    operation_id            INT           NOT NULL,
    product_id              INT           NOT NULL,
    source_location_id      INT,
    destination_location_id INT,
    quantity                DECIMAL(12,4) NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (operation_id)            REFERENCES operations(id),
    FOREIGN KEY (product_id)              REFERENCES products(id),
    FOREIGN KEY (source_location_id)      REFERENCES locations(id),
    FOREIGN KEY (destination_location_id) REFERENCES locations(id)
) ENGINE=InnoDB;

-- ── Stock Ledger (immutable audit trail) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_ledger (
    id              INT           NOT NULL AUTO_INCREMENT,
    product_id      INT           NOT NULL,
    operation_id    INT,
    operation_type  ENUM('RECEIPT','DELIVERY','TRANSFER','ADJUSTMENT') NOT NULL,
    location_id     INT           NOT NULL,
    quantity_change DECIMAL(12,4) NOT NULL,
    reference       VARCHAR(100),
    user_id         INT,
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (product_id)   REFERENCES products(id),
    FOREIGN KEY (operation_id) REFERENCES operations(id),
    FOREIGN KEY (location_id)  REFERENCES locations(id),
    FOREIGN KEY (user_id)      REFERENCES users(id)
) ENGINE=InnoDB;

-- ── Purpose-scoped OTPs and password-reset grants (HMAC hashes) ────────────
CREATE TABLE IF NOT EXISTS otp_tokens (
    id         INT          NOT NULL AUTO_INCREMENT,
    email      VARCHAR(255) NOT NULL,
    otp        VARCHAR(64)  NOT NULL,
    purpose    VARCHAR(30)  NOT NULL DEFAULT 'password_reset',
    expires_at DATETIME     NOT NULL,
    used       TINYINT(1)   NOT NULL DEFAULT 0,
    attempt_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_otp_email (email)
) ENGINE=InnoDB;

-- ============================================================
-- Seed Data — default warehouse + locations + categories
-- ============================================================

INSERT IGNORE INTO warehouses (name)
VALUES ('Main Warehouse');

INSERT INTO locations (warehouse_id, name)
SELECT w.id, 'Main Storage'
FROM warehouses w
WHERE w.name = 'Main Warehouse'
    AND NOT EXISTS (
            SELECT 1 FROM locations l
            WHERE l.warehouse_id = w.id AND l.name = 'Main Storage'
    );

INSERT IGNORE INTO categories (name)
VALUES ('Raw Material'), ('Finished Goods'), ('Consumables');

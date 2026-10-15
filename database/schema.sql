-- Esquema Etapa 1 (MySQL 8+, InnoDB). Solo datos ficticios.
-- Supuestos por validar con la empresa: P-05 (cartera), P-07 (roles).
SET NAMES utf8mb4;

CREATE TABLE rol (
  id_rol TINYINT UNSIGNED PRIMARY KEY,
  nombre VARCHAR(20) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE usuario (
  id_usuario BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  nombre VARCHAR(120) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  id_rol TINYINT UNSIGNED NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  creado_en DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  FOREIGN KEY (id_rol) REFERENCES rol (id_rol)
) ENGINE=InnoDB;

CREATE TABLE socio (
  id_socio BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_usuario BIGINT UNSIGNED NOT NULL UNIQUE,
  FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
) ENGINE=InnoDB;

CREATE TABLE cliente (
  id_cliente BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_usuario BIGINT UNSIGNED NULL UNIQUE,
  nombre VARCHAR(120) NOT NULL,
  telefono VARCHAR(30) NULL,
  email VARCHAR(190) NULL,
  creado_en DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
) ENGINE=InnoDB;

CREATE TABLE cliente_socio (
  id_cliente BIGINT UNSIGNED NOT NULL,
  id_socio BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (id_cliente, id_socio),
  FOREIGN KEY (id_cliente) REFERENCES cliente (id_cliente),
  FOREIGN KEY (id_socio) REFERENCES socio (id_socio)
) ENGINE=InnoDB;

CREATE TABLE tipo_avaluo (
  id_tipo TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(40) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE estado (
  id_estado TINYINT UNSIGNED PRIMARY KEY,
  nombre VARCHAR(20) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE solicitud (
  id_solicitud BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  folio VARCHAR(20) NOT NULL UNIQUE,
  id_cliente BIGINT UNSIGNED NOT NULL,
  id_tipo TINYINT UNSIGNED NOT NULL,
  id_socio BIGINT UNSIGNED NULL,
  id_estado TINYINT UNSIGNED NOT NULL,
  origen ENUM('whatsapp','llamada','recomendacion','empresa','web') NOT NULL,
  proposito VARCHAR(255) NOT NULL,
  descripcion_bien VARCHAR(255) NOT NULL,
  creada_en DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  FOREIGN KEY (id_cliente) REFERENCES cliente (id_cliente),
  FOREIGN KEY (id_tipo) REFERENCES tipo_avaluo (id_tipo),
  FOREIGN KEY (id_socio) REFERENCES socio (id_socio),
  FOREIGN KEY (id_estado) REFERENCES estado (id_estado),
  INDEX idx_solicitud_estado (id_estado),
  INDEX idx_solicitud_socio (id_socio),
  INDEX idx_solicitud_cliente (id_cliente),
  INDEX idx_solicitud_fecha (creada_en)
) ENGINE=InnoDB;

CREATE TABLE asignacion (
  id_asignacion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_solicitud BIGINT UNSIGNED NOT NULL,
  id_socio BIGINT UNSIGNED NOT NULL,
  id_usuario_asigna BIGINT UNSIGNED NOT NULL,
  asignada_en DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  FOREIGN KEY (id_solicitud) REFERENCES solicitud (id_solicitud),
  FOREIGN KEY (id_socio) REFERENCES socio (id_socio),
  FOREIGN KEY (id_usuario_asigna) REFERENCES usuario (id_usuario)
) ENGINE=InnoDB;

CREATE TABLE cotizacion_administrativa (
  id_cotizacion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_solicitud BIGINT UNSIGNED NOT NULL,
  importe DECIMAL(12,2) NOT NULL,
  estatus ENUM('propuesta','acordada','cancelada') NOT NULL DEFAULT 'propuesta',
  registrada_por BIGINT UNSIGNED NOT NULL,
  creada_en DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  FOREIGN KEY (id_solicitud) REFERENCES solicitud (id_solicitud),
  FOREIGN KEY (registrada_por) REFERENCES usuario (id_usuario)
) ENGINE=InnoDB;

-- P-05: el permiso es por solicitud individual, vigente mientras revocado_en sea NULL.
CREATE TABLE permiso_compartido (
  id_permiso BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_solicitud BIGINT UNSIGNED NOT NULL,
  id_socio_destino BIGINT UNSIGNED NOT NULL,
  autorizado_por BIGINT UNSIGNED NOT NULL,
  otorgado_en DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  revocado_en DATETIME(3) NULL,
  revocado_por BIGINT UNSIGNED NULL,
  FOREIGN KEY (id_solicitud) REFERENCES solicitud (id_solicitud),
  FOREIGN KEY (id_socio_destino) REFERENCES socio (id_socio),
  FOREIGN KEY (autorizado_por) REFERENCES usuario (id_usuario),
  FOREIGN KEY (revocado_por) REFERENCES usuario (id_usuario),
  INDEX idx_permiso_destino (id_socio_destino, revocado_en)
) ENGINE=InnoDB;

CREATE TABLE historial_estado (
  id_historial BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_solicitud BIGINT UNSIGNED NOT NULL,
  estado_anterior TINYINT UNSIGNED NULL,
  estado_nuevo TINYINT UNSIGNED NOT NULL,
  id_usuario_actor BIGINT UNSIGNED NOT NULL,
  fecha_hora_utc DATETIME(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6)),
  motivo VARCHAR(255) NULL,
  tipo_evento ENUM('creacion','transicion','correccion_autorizada') NOT NULL,
  FOREIGN KEY (id_solicitud) REFERENCES solicitud (id_solicitud),
  FOREIGN KEY (estado_anterior) REFERENCES estado (id_estado),
  FOREIGN KEY (estado_nuevo) REFERENCES estado (id_estado),
  FOREIGN KEY (id_usuario_actor) REFERENCES usuario (id_usuario),
  INDEX idx_historial_solicitud (id_solicitud, fecha_hora_utc)
) ENGINE=InnoDB;

-- Eventos de permisos y de administracion de usuarios (RNF-04, RF-05).
CREATE TABLE auditoria_sistema (
  id_auditoria BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tipo_evento VARCHAR(40) NOT NULL,
  id_usuario_actor BIGINT UNSIGNED NOT NULL,
  id_solicitud BIGINT UNSIGNED NULL,
  id_usuario_objetivo BIGINT UNSIGNED NULL,
  detalle VARCHAR(255) NULL,
  fecha_hora_utc DATETIME(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6)),
  FOREIGN KEY (id_usuario_actor) REFERENCES usuario (id_usuario),
  FOREIGN KEY (id_solicitud) REFERENCES solicitud (id_solicitud),
  FOREIGN KEY (id_usuario_objetivo) REFERENCES usuario (id_usuario),
  INDEX idx_auditoria_fecha (fecha_hora_utc)
) ENGINE=InnoDB;

-- Bitacoras solo-insercion: nadie puede editar ni borrar eventos.
DELIMITER $$
CREATE TRIGGER historial_no_update BEFORE UPDATE ON historial_estado
FOR EACH ROW BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'historial_estado es solo-insercion';
END$$
CREATE TRIGGER historial_no_delete BEFORE DELETE ON historial_estado
FOR EACH ROW BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'historial_estado es solo-insercion';
END$$
CREATE TRIGGER auditoria_no_update BEFORE UPDATE ON auditoria_sistema
FOR EACH ROW BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'auditoria_sistema es solo-insercion';
END$$
CREATE TRIGGER auditoria_no_delete BEFORE DELETE ON auditoria_sistema
FOR EACH ROW BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'auditoria_sistema es solo-insercion';
END$$
DELIMITER ;

-- Catalogos.
INSERT INTO rol (id_rol, nombre) VALUES (1,'cliente'),(2,'socio'),(3,'asistente'),(4,'admin');
INSERT INTO estado (id_estado, nombre) VALUES
  (1,'Recibida'),(2,'Asignada'),(3,'En proceso'),(4,'Entregada'),(5,'Cancelada');
INSERT INTO tipo_avaluo (nombre) VALUES
  ('Comercial'),('Judicial'),('Fiscal'),('Catastral'),('Credito');

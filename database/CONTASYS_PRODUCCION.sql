-- =====================================================================
-- CONTASYS - ESQUEMA DE PRODUCCION
-- Motor: MySQL 8.0+ / MariaDB 10.5+
-- Script idempotente: se puede ejecutar de inicio a fin las veces que
-- sea necesario (recrea la base de datos desde cero).
--
-- NO incluye usuarios, ingresos ni egresos de prueba.
-- Solo trae cargados los datos de CATALOGO que la aplicacion
-- necesita para funcionar desde el primer momento (roles, categorias
-- financieras y metodos de pago). Los usuarios, movimientos, reportes,
-- etc. los crea el cliente real usando la aplicacion.

-- =====================================================================

DROP DATABASE IF EXISTS contasys_actualizado;
CREATE DATABASE contasys_actualizado CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE contasys_actualizado;

-- =====================================================================
-- 1. TABLAS
-- =====================================================================


CREATE TABLE Rol(
  idRol            INT AUTO_INCREMENT PRIMARY KEY,
  nombreRol        VARCHAR(50) NOT NULL UNIQUE,
  descripcion      VARCHAR(255) NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE Usuario(
  idUsuario        INT AUTO_INCREMENT PRIMARY KEY,
  documento        VARCHAR(30) NOT NULL UNIQUE,
  nombre           VARCHAR(100) NOT NULL,
  apellido         VARCHAR(100) NOT NULL,
  correo           VARCHAR(100) NOT NULL UNIQUE,
  password_hash    VARCHAR(255) NOT NULL,
  telefono         VARCHAR(20)  NULL,
  ciudad           VARCHAR(80)  NULL,
  fechaRegistro    DATE NOT NULL,
  estado           ENUM('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  idRol            INT NOT NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT FK_Usuario_Rol FOREIGN KEY(idRol) REFERENCES Rol(idRol)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE CategoriaFinanciera(
  idCategoria         INT AUTO_INCREMENT PRIMARY KEY,
  codigoCategoria     VARCHAR(20) NOT NULL UNIQUE,
  nombreCategoria     VARCHAR(100) NOT NULL,
  tipo                ENUM('Ingreso','Egreso') NOT NULL,
  descripcion         VARCHAR(500) NULL,
  estado              ENUM('Activa','Inactiva') NOT NULL DEFAULT 'Activa',
  fechaCreacion       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fechaActualizacion  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT UQ_Categoria_Nombre_Tipo UNIQUE(nombreCategoria,tipo)
) ENGINE=InnoDB;

CREATE TABLE MetodoPago(
  idMetodoPago     INT AUTO_INCREMENT PRIMARY KEY,
  nombreMetodo     VARCHAR(50) NOT NULL UNIQUE,
  descripcion      VARCHAR(255) NULL,
  estado           ENUM('Activo','Inactivo') NOT NULL DEFAULT 'Activo'
) ENGINE=InnoDB;

CREATE TABLE Ingreso(
  idIngreso          INT AUTO_INCREMENT PRIMARY KEY,
  monto              DECIMAL(12,2) NOT NULL,
  descripcion        TEXT NULL,
  numeroComprobante  VARCHAR(100) NULL,
  observaciones      TEXT NULL,
  fecha              DATE NOT NULL,
  idUsuario          INT NOT NULL,
  idCategoria        INT NOT NULL,
  idMetodoPago       INT NOT NULL,
  estadoTransaccion  ENUM('Pendiente','Confirmada','Anulada') NOT NULL DEFAULT 'Confirmada',
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT CK_Ingreso_Monto CHECK(monto > 0),
  CONSTRAINT FK_Ingreso_Usuario FOREIGN KEY(idUsuario) REFERENCES Usuario(idUsuario)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT FK_Ingreso_Categoria FOREIGN KEY(idCategoria) REFERENCES CategoriaFinanciera(idCategoria)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT FK_Ingreso_MetodoPago FOREIGN KEY(idMetodoPago) REFERENCES MetodoPago(idMetodoPago)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX IDX_Ingreso_Fecha  ON Ingreso(fecha);
CREATE INDEX IDX_Ingreso_Estado ON Ingreso(estadoTransaccion);

CREATE TABLE Egreso(
  idEgreso           INT AUTO_INCREMENT PRIMARY KEY,
  monto              DECIMAL(12,2) NOT NULL,
  descripcion        TEXT NULL,
  numeroComprobante  VARCHAR(100) NULL,
  observaciones      TEXT NULL,
  fecha              DATE NOT NULL,
  idUsuario          INT NOT NULL,
  idCategoria        INT NOT NULL,
  idMetodoPago       INT NOT NULL,
  estadoTransaccion  ENUM('Pendiente','Confirmada','Anulada') NOT NULL DEFAULT 'Confirmada',
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT CK_Egreso_Monto CHECK(monto > 0),
  CONSTRAINT FK_Egreso_Usuario FOREIGN KEY(idUsuario) REFERENCES Usuario(idUsuario)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT FK_Egreso_Categoria FOREIGN KEY(idCategoria) REFERENCES CategoriaFinanciera(idCategoria)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT FK_Egreso_MetodoPago FOREIGN KEY(idMetodoPago) REFERENCES MetodoPago(idMetodoPago)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX IDX_Egreso_Fecha  ON Egreso(fecha);
CREATE INDEX IDX_Egreso_Estado ON Egreso(estadoTransaccion);

CREATE TABLE Presupuesto(
  idPresupuesto      INT AUTO_INCREMENT PRIMARY KEY,
  nombrePresupuesto  VARCHAR(100) NOT NULL,
  montoPresupuesto   DECIMAL(12,2) NOT NULL,
  fechaInicio        DATE NOT NULL,
  fechaFin           DATE NOT NULL,
  estado             ENUM('Activo','Finalizado','Cancelado') NOT NULL DEFAULT 'Activo',
  idUsuario          INT NOT NULL,
  idCategoria        INT NOT NULL,
  CONSTRAINT CK_Presupuesto_Monto  CHECK(montoPresupuesto > 0),
  CONSTRAINT CK_Presupuesto_Fechas CHECK(fechaFin >= fechaInicio),
  CONSTRAINT FK_Presupuesto_Usuario FOREIGN KEY(idUsuario) REFERENCES Usuario(idUsuario)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT FK_Presupuesto_Categoria FOREIGN KEY(idCategoria) REFERENCES CategoriaFinanciera(idCategoria)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX IDX_Presupuesto_Fechas ON Presupuesto(fechaInicio,fechaFin);

CREATE TABLE Reporte(
  idReporte        INT AUTO_INCREMENT PRIMARY KEY,
  nombreReporte    VARCHAR(100) NOT NULL,
  tipoReporte      ENUM('Ingresos','Egresos','Balance') NOT NULL DEFAULT 'Balance',
  formatoArchivo   ENUM('PDF','EXCEL') NOT NULL,
  fechaInicio      DATE NOT NULL,
  fechaFin         DATE NOT NULL,
  fechaGeneracion  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  idUsuario        INT NOT NULL,
  CONSTRAINT CK_Reporte_Fechas CHECK(fechaFin >= fechaInicio),
  CONSTRAINT FK_Reporte_Usuario FOREIGN KEY(idUsuario) REFERENCES Usuario(idUsuario)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE Mensaje(
  idMensaje        INT AUTO_INCREMENT PRIMARY KEY,
  contenido        TEXT NOT NULL,
  fechaEnvio       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  leido            BOOLEAN NOT NULL DEFAULT FALSE,
  idEmisor         INT NOT NULL,
  idReceptor       INT NOT NULL,
  CONSTRAINT FK_Mensaje_Emisor FOREIGN KEY(idEmisor) REFERENCES Usuario(idUsuario)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT FK_Mensaje_Receptor FOREIGN KEY(idReceptor) REFERENCES Usuario(idUsuario)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE Notificacion(
  idNotificacion   INT AUTO_INCREMENT PRIMARY KEY,
  mensaje          VARCHAR(255) NOT NULL,
  fecha            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado           ENUM('Pendiente','Vista','Archivada') NOT NULL DEFAULT 'Pendiente',
  idUsuario        INT NOT NULL,
  CONSTRAINT FK_Notificacion_Usuario FOREIGN KEY(idUsuario) REFERENCES Usuario(idUsuario)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE Suscripcion(
  idSuscripcion    INT AUTO_INCREMENT PRIMARY KEY,
  tipoPlan         ENUM('Free','Premium') NOT NULL DEFAULT 'Free',
  fechaInicio      DATE NOT NULL,
  fechaFin         DATE NOT NULL,
  estado           ENUM('Activa','Vencida','Cancelada') NOT NULL DEFAULT 'Activa',
  idUsuario        INT NOT NULL UNIQUE,
  CONSTRAINT CK_Suscripcion_Fechas CHECK(fechaFin >= fechaInicio),
  CONSTRAINT FK_Suscripcion_Usuario FOREIGN KEY(idUsuario) REFERENCES Usuario(idUsuario)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE HistorialActividad(
  idHistorial      INT AUTO_INCREMENT PRIMARY KEY,
  accion           VARCHAR(150) NOT NULL,
  modulo           VARCHAR(50)  NOT NULL,
  fecha            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ipUsuario        VARCHAR(45)  NULL,
  idUsuario        INT NOT NULL,
  CONSTRAINT FK_Historial_Usuario FOREIGN KEY(idUsuario) REFERENCES Usuario(idUsuario)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX IDX_Historial_Usuario ON HistorialActividad(idUsuario);
CREATE INDEX IDX_Historial_Fecha   ON HistorialActividad(fecha);


-- =====================================================================
-- 2. TRIGGERS DE INTEGRIDAD
-- =====================================================================


DELIMITER $$

CREATE TRIGGER TR_Ingreso_ValidarCategoria_INS
BEFORE INSERT ON Ingreso FOR EACH ROW
BEGIN
  DECLARE v_tipo VARCHAR(10);
  SELECT tipo INTO v_tipo FROM CategoriaFinanciera WHERE idCategoria = NEW.idCategoria;
  IF v_tipo <> 'Ingreso' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'La categoria asignada no es de tipo Ingreso';
  END IF;
END$$

CREATE TRIGGER TR_Ingreso_ValidarCategoria_UPD
BEFORE UPDATE ON Ingreso FOR EACH ROW
BEGIN
  DECLARE v_tipo VARCHAR(10);
  SELECT tipo INTO v_tipo FROM CategoriaFinanciera WHERE idCategoria = NEW.idCategoria;
  IF v_tipo <> 'Ingreso' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'La categoria asignada no es de tipo Ingreso';
  END IF;
END$$

CREATE TRIGGER TR_Egreso_ValidarCategoria_INS
BEFORE INSERT ON Egreso FOR EACH ROW
BEGIN
  DECLARE v_tipo VARCHAR(10);
  SELECT tipo INTO v_tipo FROM CategoriaFinanciera WHERE idCategoria = NEW.idCategoria;
  IF v_tipo <> 'Egreso' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'La categoria asignada no es de tipo Egreso';
  END IF;
END$$

CREATE TRIGGER TR_Egreso_ValidarCategoria_UPD
BEFORE UPDATE ON Egreso FOR EACH ROW
BEGIN
  DECLARE v_tipo VARCHAR(10);
  SELECT tipo INTO v_tipo FROM CategoriaFinanciera WHERE idCategoria = NEW.idCategoria;
  IF v_tipo <> 'Egreso' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'La categoria asignada no es de tipo Egreso';
  END IF;
END$$

CREATE TRIGGER TR_Mensaje_NoAutoenvio_INS
BEFORE INSERT ON Mensaje FOR EACH ROW
BEGIN
  IF NEW.idEmisor = NEW.idReceptor THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'El emisor y el receptor no pueden ser el mismo usuario';
  END IF;
END$$

CREATE TRIGGER TR_Mensaje_NoAutoenvio_UPD
BEFORE UPDATE ON Mensaje FOR EACH ROW
BEGIN
  IF NEW.idEmisor = NEW.idReceptor THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'El emisor y el receptor no pueden ser el mismo usuario';
  END IF;
END$$

DELIMITER ;


-- =====================================================================
-- 3. DATOS DE CATALOGO
-- No son datos de prueba: son configuracion base que la aplicacion
-- necesita para funcionar (listas desplegables de rol, categoria y
-- metodo de pago). Ajusta estos valores a lo que tu cliente use
-- realmente antes de poner el sistema en marcha.
-- =====================================================================

INSERT INTO Rol(nombreRol,descripcion) VALUES
('Administrador','Control total del sistema'),
('Contador','Gestion contable de terceros'),
('Emprendedor','Gestion de sus propias finanzas');

INSERT INTO CategoriaFinanciera(codigoCategoria,nombreCategoria,tipo,descripcion) VALUES
('ING-001','Ventas','Ingreso','Ingresos obtenidos por la venta de productos y equipos'),
('ING-002','Servicios','Ingreso','Ingresos obtenidos por la prestacion de servicios'),
('ING-003','Salario','Ingreso','Ingresos correspondientes a pagos de salario'),
('EGR-001','Arriendo','Egreso','Pago de arriendo'),
('EGR-002','Servicios Publicos','Egreso','Agua y energia'),
('EGR-003','Papeleria','Egreso','Compra de utiles'),
('EGR-004','Transporte','Egreso','Gastos de transporte');

INSERT INTO MetodoPago(nombreMetodo,descripcion) VALUES
('Efectivo','Pago realizado en efectivo'),
('Transferencia','Transferencia bancaria'),
('Tarjeta Debito','Pago con tarjeta debito'),
('Tarjeta Credito','Pago con tarjeta credito'),
('Nequi','Pago mediante Nequi'),
('Daviplata','Pago mediante Daviplata');


-- =====================================================================
-- 4. VISTAS DE REPORTES
-- Pensadas para que el backend (Seccion 6) consuma datos ya resueltos,
-- sin tener que repetir estos JOIN en cada endpoint.
-- =====================================================================

CREATE VIEW vw_detalle_ingresos AS
SELECT i.idIngreso, CONCAT(u.nombre,' ',u.apellido) AS usuario,
       c.nombreCategoria AS categoria, mp.nombreMetodo AS metodoPago,
       i.monto, i.numeroComprobante, i.estadoTransaccion, i.fecha
FROM Ingreso i
JOIN Usuario u              ON i.idUsuario    = u.idUsuario
JOIN CategoriaFinanciera c  ON i.idCategoria  = c.idCategoria
JOIN MetodoPago mp          ON i.idMetodoPago = mp.idMetodoPago;

CREATE VIEW vw_detalle_egresos AS
SELECT e.idEgreso, CONCAT(u.nombre,' ',u.apellido) AS usuario,
       c.nombreCategoria AS categoria, mp.nombreMetodo AS metodoPago,
       e.monto, e.numeroComprobante, e.estadoTransaccion, e.fecha
FROM Egreso e
JOIN Usuario u              ON e.idUsuario    = u.idUsuario
JOIN CategoriaFinanciera c  ON e.idCategoria  = c.idCategoria
JOIN MetodoPago mp          ON e.idMetodoPago = mp.idMetodoPago;

CREATE VIEW vw_gasto_por_categoria AS
SELECT c.nombreCategoria AS categoria,
       COUNT(e.idEgreso) AS cantidadMovimientos,
       COALESCE(SUM(e.monto),0) AS totalGastado
FROM Egreso e
JOIN CategoriaFinanciera c ON e.idCategoria = c.idCategoria
WHERE e.estadoTransaccion='Confirmada'
GROUP BY c.idCategoria, c.nombreCategoria;

CREATE VIEW vw_ingresos_por_metodo_pago AS
SELECT mp.nombreMetodo AS metodoPago,
       COUNT(i.idIngreso) AS cantidadIngresos,
       COALESCE(SUM(i.monto),0) AS totalIngresos
FROM Ingreso i
JOIN MetodoPago mp ON i.idMetodoPago = mp.idMetodoPago
WHERE i.estadoTransaccion='Confirmada'
GROUP BY mp.idMetodoPago, mp.nombreMetodo;

CREATE VIEW vw_balance_por_usuario AS
SELECT u.idUsuario, CONCAT(u.nombre,' ',u.apellido) AS usuario,
       COALESCE((SELECT SUM(i.monto) FROM Ingreso i
                 WHERE i.idUsuario=u.idUsuario AND i.estadoTransaccion='Confirmada'),0) -
       COALESCE((SELECT SUM(e.monto) FROM Egreso e
                 WHERE e.idUsuario=u.idUsuario AND e.estadoTransaccion='Confirmada'),0) AS balance
FROM Usuario u;

CREATE VIEW vw_presupuesto_vs_ejecucion AS
SELECT p.idPresupuesto, p.nombrePresupuesto AS presupuesto,
       c.nombreCategoria AS categoria, c.tipo AS tipoCategoria,
       p.montoPresupuesto AS montoPlaneado,
       COALESCE(SUM(mov.monto),0) AS montoReal,
       p.montoPresupuesto - COALESCE(SUM(mov.monto),0) AS diferencia
FROM Presupuesto p
JOIN CategoriaFinanciera c ON p.idCategoria = c.idCategoria
LEFT JOIN (
    SELECT idUsuario, idCategoria, fecha, monto FROM Ingreso WHERE estadoTransaccion='Confirmada'
    UNION ALL
    SELECT idUsuario, idCategoria, fecha, monto FROM Egreso  WHERE estadoTransaccion='Confirmada'
) mov
  ON  mov.idCategoria = p.idCategoria
  AND mov.idUsuario   = p.idUsuario
  AND mov.fecha BETWEEN p.fechaInicio AND p.fechaFin
GROUP BY p.idPresupuesto, p.nombrePresupuesto, c.nombreCategoria, c.tipo, p.montoPresupuesto;

CREATE VIEW vw_suscripciones AS
SELECT u.idUsuario, CONCAT(u.nombre,' ',u.apellido) AS usuario,
       s.tipoPlan, s.estado, s.fechaInicio, s.fechaFin
FROM Usuario u
JOIN Suscripcion s ON u.idUsuario = s.idUsuario;

CREATE VIEW vw_historial_actividad AS
SELECT h.idHistorial, CONCAT(u.nombre,' ',u.apellido) AS usuario,
       h.accion, h.modulo, h.ipUsuario, h.fecha
FROM HistorialActividad h
JOIN Usuario u ON h.idUsuario = u.idUsuario;


-- =====================================================================
-- 5. VERIFICACION
-- =====================================================================


SHOW TABLES;

SELECT TABLE_NAME AS Tabla, TABLE_ROWS AS RegistrosAproximados
FROM information_schema.TABLES
WHERE TABLE_SCHEMA='contasys_actualizado' AND TABLE_TYPE='BASE TABLE'
ORDER BY TABLE_NAME;

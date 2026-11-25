-- =====================================================================
-- CONTASYS - MIGRACION: roles diferenciados y plan Premium
-- Para instalaciones nuevas y existentes.
-- Seleccionar explícitamente el esquema de destino antes de ejecutar.
-- =====================================================================
CREATE TABLE IF NOT EXISTS ClienteContador(
  idVinculo        INT AUTO_INCREMENT PRIMARY KEY,
  idContador       INT NOT NULL,
  idCliente        INT NOT NULL,
  estado           ENUM('Pendiente','Aceptado','Rechazado') NOT NULL DEFAULT 'Pendiente',
  fechaSolicitud   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fechaRespuesta   DATETIME NULL,
  CONSTRAINT UQ_Vinculo UNIQUE(idContador,idCliente),
  CONSTRAINT FK_Vinculo_Contador FOREIGN KEY(idContador) REFERENCES Usuario(idUsuario)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT FK_Vinculo_Cliente FOREIGN KEY(idCliente) REFERENCES Usuario(idUsuario)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;


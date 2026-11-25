-- Seleccionar el esquema actualizado de CONTASYS antes de ejecutar.
CREATE TABLE IF NOT EXISTS Factura (
    idFactura INT AUTO_INCREMENT PRIMARY KEY,
    idUsuario INT NOT NULL,
    consecutivo INT UNSIGNED NOT NULL,
    revision INT UNSIGNED NOT NULL DEFAULT 1,
    fecha DATE NOT NULL,
    estado ENUM('Borrador','Pendiente','Pagada','Anulada') NOT NULL,
    emisorNombre VARCHAR(201) NOT NULL,
    emisorDocumento VARCHAR(30) NOT NULL,
    emisorCorreo VARCHAR(100) NOT NULL,
    receptorNombre VARCHAR(150) NOT NULL,
    receptorDocumento VARCHAR(50) NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    descuento DECIMAL(12,2) NOT NULL,
    impuesto DECIMAL(12,2) NOT NULL,
    total DECIMAL(12,2) NOT NULL,
    fechaEmision DATETIME NULL,
    fechaPago DATE NULL,
    idIngreso INT NULL,
    UNIQUE KEY UQ_Factura_Consecutivo (idUsuario, consecutivo),
    UNIQUE KEY UQ_Factura_Ingreso (idIngreso),
    INDEX IDX_Factura_Historial (idUsuario, fecha, idFactura),
    CONSTRAINT FK_Factura_Usuario FOREIGN KEY (idUsuario) REFERENCES Usuario(idUsuario) ON DELETE RESTRICT,
    CONSTRAINT FK_Factura_Ingreso FOREIGN KEY (idIngreso) REFERENCES Ingreso(idIngreso) ON DELETE RESTRICT,
    CONSTRAINT CK_Factura_Importes CHECK (subtotal >= descuento AND descuento >= 0 AND impuesto >= 0 AND total = subtotal - descuento + impuesto),
    CONSTRAINT CK_Factura_Emision CHECK (
        (estado = 'Borrador' AND fechaEmision IS NULL)
        OR (estado IN ('Pendiente','Pagada') AND fechaEmision IS NOT NULL)
        OR estado = 'Anulada'
    ),
    CONSTRAINT CK_Factura_Pago CHECK (
        (estado = 'Pagada' AND idIngreso IS NOT NULL AND fechaPago IS NOT NULL)
        OR (estado <> 'Pagada' AND idIngreso IS NULL AND fechaPago IS NULL)
    )
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS FacturaDetalle (
    idFactura INT NOT NULL,
    revision INT UNSIGNED NOT NULL,
    renglon SMALLINT UNSIGNED NOT NULL,
    concepto VARCHAR(250) NOT NULL,
    cantidad DECIMAL(9,3) NOT NULL,
    precioUnitario DECIMAL(12,2) NOT NULL,
    porcentajeDescuento DECIMAL(5,2) NOT NULL,
    porcentajeImpuesto DECIMAL(5,2) NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    descuento DECIMAL(12,2) NOT NULL,
    impuesto DECIMAL(12,2) NOT NULL,
    total DECIMAL(12,2) NOT NULL,
    PRIMARY KEY (idFactura, revision, renglon),
    CONSTRAINT FK_FacturaDetalle_Factura FOREIGN KEY (idFactura) REFERENCES Factura(idFactura) ON DELETE RESTRICT,
    CONSTRAINT CK_FacturaDetalle_Importes CHECK (
        cantidad > 0 AND precioUnitario > 0 AND porcentajeDescuento BETWEEN 0 AND 100
        AND porcentajeImpuesto BETWEEN 0 AND 100 AND subtotal >= descuento
        AND descuento >= 0 AND impuesto >= 0 AND total = subtotal - descuento + impuesto
    )
) ENGINE=InnoDB;

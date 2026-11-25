-- No reconstruye ni asigna origen a pagos históricos.
CREATE TABLE IF NOT EXISTS PagoFactura (
    idPago INT AUTO_INCREMENT PRIMARY KEY,
    idFactura INT NOT NULL,
    idIngreso INT NOT NULL,
    origen ENUM('Facturacion','Conciliacion') NOT NULL,
    fechaPago DATE NOT NULL,
    monto DECIMAL(12,2) NOT NULL,
    idCategoria INT NOT NULL,
    idMetodoPago INT NOT NULL,
    registradoEn DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    corregidoEn DATETIME NULL,
    motivoCorreccion VARCHAR(500) NULL,
    idActorCorreccion INT NULL,
    INDEX IDX_PagoFactura_Factura (idFactura, idPago),
    CONSTRAINT FK_PagoFactura_Factura FOREIGN KEY (idFactura) REFERENCES Factura(idFactura) ON DELETE RESTRICT,
    CONSTRAINT FK_PagoFactura_Ingreso FOREIGN KEY (idIngreso) REFERENCES Ingreso(idIngreso) ON DELETE RESTRICT,
    CONSTRAINT FK_PagoFactura_Categoria FOREIGN KEY (idCategoria) REFERENCES CategoriaFinanciera(idCategoria) ON DELETE RESTRICT,
    CONSTRAINT FK_PagoFactura_Metodo FOREIGN KEY (idMetodoPago) REFERENCES MetodoPago(idMetodoPago) ON DELETE RESTRICT,
    CONSTRAINT FK_PagoFactura_Actor FOREIGN KEY (idActorCorreccion) REFERENCES Usuario(idUsuario) ON DELETE RESTRICT,
    CONSTRAINT CK_PagoFactura_Correccion CHECK (
        (corregidoEn IS NULL AND motivoCorreccion IS NULL AND idActorCorreccion IS NULL) OR
        (corregidoEn IS NOT NULL AND motivoCorreccion IS NOT NULL AND idActorCorreccion IS NOT NULL)
    ),
    CONSTRAINT CK_PagoFactura_Monto CHECK (monto > 0)
) ENGINE=InnoDB;

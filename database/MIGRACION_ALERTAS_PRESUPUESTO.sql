-- Ejecutar sobre el esquema seleccionado. Conserva las notificaciones existentes.
CREATE TABLE IF NOT EXISTS EventoPresupuesto (
    idPresupuesto INT NOT NULL,
    tipo ENUM('Preventiva','LimiteAlcanzado','Exceso','MetaAlcanzada') NOT NULL,
    idNotificacion INT NOT NULL,
    PRIMARY KEY (idPresupuesto, tipo),
    UNIQUE KEY UQ_Evento_Notificacion (idNotificacion),
    CONSTRAINT FK_Evento_Notificacion FOREIGN KEY (idNotificacion) REFERENCES Notificacion(idNotificacion)
        ON DELETE RESTRICT
) ENGINE=InnoDB;

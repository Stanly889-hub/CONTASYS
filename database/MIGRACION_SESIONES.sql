-- Ejecutar sobre la base seleccionada explícitamente por el operador.
CREATE TABLE IF NOT EXISTS Sesion (
    idSesion CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    idUsuario INT NOT NULL,
    expiraUnix BIGINT UNSIGNED NOT NULL,
    revocada BOOLEAN NOT NULL DEFAULT FALSE,
    INDEX IDX_Sesion_Usuario (idUsuario),
    INDEX IDX_Sesion_Expiracion (expiraUnix),
    CONSTRAINT FK_Sesion_Usuario FOREIGN KEY (idUsuario) REFERENCES Usuario (idUsuario)
) ENGINE=InnoDB;

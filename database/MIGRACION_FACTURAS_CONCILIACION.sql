-- Aplicar una sola vez sobre el esquema seleccionado, con escrituras pausadas.
ALTER TABLE Factura
    MODIFY fecha DATE NULL,
    MODIFY receptorNombre VARCHAR(150) NULL,
    ADD COLUMN borradorDatos JSON NULL,
    ADD CONSTRAINT CK_Factura_DatosEmitidos CHECK (
        fechaEmision IS NULL OR (fecha IS NOT NULL AND receptorNombre IS NOT NULL)
    );

ALTER TABLE ClienteContador ADD COLUMN facturasAutorizadas BOOLEAN NOT NULL DEFAULT FALSE;

DELIMITER $$
CREATE TRIGGER TR_Vinculo_RevocarFacturas
BEFORE UPDATE ON ClienteContador FOR EACH ROW
BEGIN
    IF NEW.estado <> 'Aceptado' OR OLD.estado <> 'Aceptado' THEN
        SET NEW.facturasAutorizadas = FALSE;
    END IF;
END$$
DELIMITER ;

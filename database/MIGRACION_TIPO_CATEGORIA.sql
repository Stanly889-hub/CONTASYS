-- Ejecutar una vez sobre el esquema seleccionado.
DELIMITER $$
CREATE TRIGGER TR_Categoria_ConservarTipo
BEFORE UPDATE ON CategoriaFinanciera FOR EACH ROW
BEGIN
    IF OLD.tipo <> NEW.tipo THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El tipo de una categoria existente no se puede cambiar';
    END IF;
END$$
DELIMITER ;

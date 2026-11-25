-- Aplicar una vez sobre el esquema seleccionado, con escrituras pausadas.
ALTER TABLE ClienteContador
    MODIFY estado ENUM('Pendiente','Aceptado','Rechazado','Suspendido','Revocado')
    NOT NULL DEFAULT 'Pendiente';

START TRANSACTION;
INSERT INTO HistorialActividad (accion, modulo, idUsuario)
SELECT CONCAT('Vínculo ', v.idVinculo, ' suspendido por roles incompatibles'), 'Clientes', partes.idUsuario
FROM ClienteContador v
JOIN Usuario c ON c.idUsuario = v.idContador
JOIN Usuario e ON e.idUsuario = v.idCliente
JOIN Rol rc ON rc.idRol = c.idRol
JOIN Rol re ON re.idRol = e.idRol
JOIN Usuario partes ON partes.idUsuario IN (v.idContador, v.idCliente)
WHERE v.estado IN ('Pendiente', 'Aceptado')
  AND (rc.nombreRol <> 'Contador' OR re.nombreRol <> 'Emprendedor');

UPDATE ClienteContador v
JOIN Usuario c ON c.idUsuario = v.idContador
JOIN Usuario e ON e.idUsuario = v.idCliente
JOIN Rol rc ON rc.idRol = c.idRol
JOIN Rol re ON re.idRol = e.idRol
SET v.estado = 'Suspendido'
WHERE v.estado IN ('Pendiente', 'Aceptado')
  AND (rc.nombreRol <> 'Contador' OR re.nombreRol <> 'Emprendedor');
COMMIT;

DELIMITER $$
CREATE TRIGGER TR_Usuario_SuspenderVinculos
AFTER UPDATE ON Usuario FOR EACH ROW
BEGIN
    DECLARE rolActual VARCHAR(50);
    IF OLD.idRol <> NEW.idRol THEN
        SELECT nombreRol INTO rolActual FROM Rol WHERE idRol = NEW.idRol;

        INSERT INTO HistorialActividad (accion, modulo, idUsuario)
        SELECT CONCAT('Vínculo ', v.idVinculo, ' suspendido por cambio de rol'), 'Clientes', partes.idUsuario
        FROM ClienteContador v
        JOIN Usuario partes ON partes.idUsuario IN (v.idContador, v.idCliente)
        WHERE v.estado IN ('Pendiente', 'Aceptado')
          AND ((v.idContador = NEW.idUsuario AND rolActual <> 'Contador')
            OR (v.idCliente = NEW.idUsuario AND rolActual <> 'Emprendedor'));

        UPDATE ClienteContador
        SET estado = 'Suspendido'
        WHERE estado IN ('Pendiente', 'Aceptado')
          AND ((idContador = NEW.idUsuario AND rolActual <> 'Contador')
            OR (idCliente = NEW.idUsuario AND rolActual <> 'Emprendedor'));
    END IF;
END$$
DELIMITER ;

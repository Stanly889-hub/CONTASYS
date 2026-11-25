-- Ejecutar únicamente tras revisar DIAGNOSTICO_INTEGRIDAD.sql.
-- Agrega Free solo a cuentas sin fila. Conserva planes activos, vencidos y cancelados.
-- La clave única de Suscripcion.idUsuario protege frente a altas simultáneas.
START TRANSACTION;

INSERT INTO Suscripcion (tipoPlan, fechaInicio, fechaFin, estado, idUsuario)
SELECT 'Free', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 YEAR), 'Activa', u.idUsuario
FROM Usuario u
WHERE NOT EXISTS (SELECT 1 FROM Suscripcion s WHERE s.idUsuario = u.idUsuario)
ON DUPLICATE KEY UPDATE idUsuario = Suscripcion.idUsuario;

SELECT ROW_COUNT() AS filas_afectadas;
COMMIT;

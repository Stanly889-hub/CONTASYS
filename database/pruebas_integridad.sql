USE contasys_actualizado;

SELECT '--- PRUEBA 1: Ingreso con categoria de tipo Egreso (debe fallar) ---' AS Prueba;
INSERT INTO Ingreso(monto,descripcion,fecha,idUsuario,idCategoria,idMetodoPago)
VALUES (100000,'prueba invalida','2026-04-01',3,4,1);

SELECT '--- PRUEBA 2: Egreso con categoria de tipo Ingreso (debe fallar) ---' AS Prueba;
INSERT INTO Egreso(monto,descripcion,fecha,idUsuario,idCategoria,idMetodoPago)
VALUES (100000,'prueba invalida','2026-04-01',3,1,1);

SELECT '--- PRUEBA 3: Mensaje de un usuario a si mismo (debe fallar) ---' AS Prueba;
INSERT INTO Mensaje(contenido,idEmisor,idReceptor) VALUES ('hola yo mismo',1,1);

SELECT '--- PRUEBA 4: Correo de usuario duplicado (debe fallar) ---' AS Prueba;
INSERT INTO Usuario(nombre,apellido,correo,password_hash,fechaRegistro,idRol,documento)
VALUES ('Prueba','Duplicado','deivid@contasys.com','hash','2026-04-01',1,'999999');

SELECT '--- PRUEBA 5: Monto de ingreso negativo (debe fallar) ---' AS Prueba;
INSERT INTO Ingreso(monto,descripcion,fecha,idUsuario,idCategoria,idMetodoPago)
VALUES (-500,'monto invalido','2026-04-01',3,1,1);

SELECT '--- PRUEBA 6: Ingreso valido (debe funcionar) ---' AS Prueba;
INSERT INTO Ingreso(monto,descripcion,fecha,idUsuario,idCategoria,idMetodoPago)
VALUES (999000,'prueba valida','2026-04-01',3,1,1);
SELECT * FROM Ingreso WHERE descripcion='prueba valida';

SELECT '--- PRUEBA 7: Eliminar un usuario y verificar borrado en cascada ---' AS Prueba;
SELECT COUNT(*) AS IngresosDeAna FROM Ingreso WHERE idUsuario=4;
DELETE FROM Usuario WHERE idUsuario=4;
SELECT COUNT(*) AS IngresosDeAnaDespuesDeEliminar FROM Ingreso WHERE idUsuario=4;

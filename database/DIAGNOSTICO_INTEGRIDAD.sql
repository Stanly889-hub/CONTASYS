-- Solo lectura. Seleccionar el esquema ya actualizado.
SELECT u.idUsuario, u.estado
FROM Usuario u
LEFT JOIN Suscripcion s ON s.idUsuario = u.idUsuario
WHERE s.idUsuario IS NULL
ORDER BY u.idUsuario;

SELECT 'Ingresos con categoría incompatible' AS control, COUNT(*) AS total
FROM Ingreso i JOIN CategoriaFinanciera c ON c.idCategoria = i.idCategoria
WHERE c.tipo <> 'Ingreso'
UNION ALL
SELECT 'Egresos con categoría incompatible', COUNT(*)
FROM Egreso e JOIN CategoriaFinanciera c ON c.idCategoria = e.idCategoria
WHERE c.tipo <> 'Egreso'
UNION ALL
SELECT 'Presupuestos con importe o fechas inválidos', COUNT(*)
FROM Presupuesto WHERE montoPresupuesto <= 0 OR fechaFin < fechaInicio
UNION ALL
SELECT 'Mensajes a la propia cuenta', COUNT(*)
FROM Mensaje WHERE idEmisor = idReceptor
UNION ALL
SELECT 'Vínculos propios o con roles distintos de los iniciales', COUNT(*)
FROM ClienteContador v
JOIN Usuario contador ON contador.idUsuario = v.idContador
JOIN Usuario cliente ON cliente.idUsuario = v.idCliente
JOIN Rol rc ON rc.idRol = contador.idRol
JOIN Rol re ON re.idRol = cliente.idRol
WHERE v.idContador = v.idCliente OR rc.nombreRol <> 'Contador' OR re.nombreRol <> 'Emprendedor';

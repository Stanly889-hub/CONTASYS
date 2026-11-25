-- Solo para un esquema de pruebas nuevo, con los tres scripts de instalación aplicados.
-- Depende de los IDs iniciales de roles y catálogos. Los hashes demo no permiten iniciar sesión.
START TRANSACTION;

INSERT INTO Usuario(documento,nombre,apellido,correo,password_hash,telefono,ciudad,fechaRegistro,estado,idRol) VALUES
('DEMO-1','Usuario 1','Demostracion','usuario1@example.invalid','CUENTA_DEMO_SIN_CLAVE','0000000001','Ciudad demo','2026-01-10','Activo',1),
('DEMO-2','Usuario 2','Demostracion','usuario2@example.invalid','CUENTA_DEMO_SIN_CLAVE','0000000002','Ciudad demo','2026-01-12','Activo',2),
('DEMO-3','Usuario 3','Demostracion','usuario3@example.invalid','CUENTA_DEMO_SIN_CLAVE','0000000003','Ciudad demo','2026-01-15','Activo',3),
('DEMO-4','Usuario 4','Demostracion','usuario4@example.invalid','CUENTA_DEMO_SIN_CLAVE','0000000004','Ciudad demo','2026-01-20','Activo',3);

INSERT INTO Ingreso(monto,descripcion,numeroComprobante,observaciones,fecha,idUsuario,idCategoria,idMetodoPago) VALUES
(2500000,'Ingreso de demostracion 1','IN-DEMO-1','Observacion ficticia','2026-02-01',3,1,2),
(850000,'Ingreso de demostracion 2','IN-DEMO-2','Observacion ficticia','2026-02-03',3,2,5),
(3200000,'Ingreso de demostracion 3','IN-DEMO-3','Observacion ficticia','2026-02-28',2,3,1),
(1250000,'Ingreso de demostracion 4','IN-DEMO-4','Observacion ficticia','2026-03-05',4,1,2),
(600000,'Ingreso de demostracion 5','IN-DEMO-5','Observacion ficticia','2026-03-08',4,2,3);

INSERT INTO Egreso(monto,descripcion,numeroComprobante,observaciones,fecha,idUsuario,idCategoria,idMetodoPago) VALUES
(1200000,'Egreso de demostracion 1','EG-DEMO-1','Observacion ficticia','2026-02-02',3,4,1),
(180000,'Egreso de demostracion 2','EG-DEMO-2','Observacion ficticia','2026-02-10',3,5,2),
(95000,'Egreso de demostracion 3','EG-DEMO-3','Observacion ficticia','2026-02-15',3,6,3),
(250000,'Egreso de demostracion 4','EG-DEMO-4','Observacion ficticia','2026-03-20',4,7,1),
(350000,'Egreso de demostracion 5','EG-DEMO-5','Observacion ficticia','2026-03-02',4,4,2);

INSERT INTO Presupuesto(nombrePresupuesto,montoPresupuesto,fechaInicio,fechaFin,estado,idUsuario,idCategoria) VALUES
('Presupuesto demo 1',1500000,'2026-02-01','2026-02-28','Finalizado',3,4),
('Presupuesto demo 2',500000,'2026-02-01','2026-02-28','Finalizado',3,5),
('Presupuesto demo 3',200000,'2026-02-01','2026-02-28','Finalizado',3,6),
('Presupuesto demo 4',400000,'2026-03-01','2026-03-31','Activo',4,7),
('Presupuesto demo 5',4000000,'2026-03-01','2026-03-31','Activo',4,1);

INSERT INTO Reporte(nombreReporte,tipoReporte,formatoArchivo,fechaInicio,fechaFin,idUsuario) VALUES
('Reporte demo 1','Balance','PDF','2026-02-01','2026-02-28',3),
('Reporte demo 2','Ingresos','EXCEL','2026-02-01','2026-02-28',2),
('Reporte demo 3','Balance','PDF','2026-03-01','2026-03-31',4);

INSERT INTO Mensaje(contenido,idEmisor,idReceptor) VALUES
('Mensaje ficticio 1',1,2),
('Mensaje ficticio 2',2,3),
('Mensaje ficticio 3',1,3),
('Mensaje ficticio 4',4,3);

INSERT INTO Notificacion(mensaje,estado,idUsuario) VALUES
('Notificacion ficticia 1','Vista',3),
('Notificacion ficticia 2','Pendiente',2),
('Notificacion ficticia 3','Pendiente',3),
('Notificacion ficticia 4','Pendiente',4);

INSERT INTO Suscripcion(tipoPlan,fechaInicio,fechaFin,estado,idUsuario) VALUES
('Premium','2026-01-10','2026-12-31','Activa',1),
('Premium','2026-01-15','2026-12-31','Activa',2),
('Premium','2026-01-20','2026-12-31','Activa',3),
('Free','2026-02-01','2026-12-31','Activa',4);

INSERT INTO HistorialActividad(accion,modulo,ipUsuario,idUsuario) VALUES
('Accion ficticia 1','Autenticacion','192.0.2.1',1),
('Accion ficticia 2','Ingresos','192.0.2.2',3),
('Accion ficticia 3','Egresos','192.0.2.3',3),
('Accion ficticia 4','Reportes','192.0.2.4',4);

COMMIT;


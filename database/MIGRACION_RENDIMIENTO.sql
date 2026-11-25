-- Ejecutar una sola vez sobre el esquema seleccionado; no sustituye índices existentes.
CREATE INDEX IDX_Ingreso_Usuario_Fecha ON Ingreso(idUsuario, fecha);
CREATE INDEX IDX_Egreso_Usuario_Fecha ON Egreso(idUsuario, fecha);
CREATE INDEX IDX_Ingreso_Ejecucion ON Ingreso(idUsuario, idCategoria, estadoTransaccion, fecha, monto);
CREATE INDEX IDX_Egreso_Ejecucion ON Egreso(idUsuario, idCategoria, estadoTransaccion, fecha, monto);
CREATE INDEX IDX_Mensaje_Conversacion ON Mensaje(idEmisor, idReceptor);
CREATE INDEX IDX_Mensaje_Pendientes ON Mensaje(idReceptor, leido, idEmisor);
CREATE INDEX IDX_Notificacion_Usuario_Fecha ON Notificacion(idUsuario, fecha);
CREATE INDEX IDX_Notificacion_Pendientes ON Notificacion(idUsuario, estado);
CREATE INDEX IDX_Historial_Usuario_Fecha ON HistorialActividad(idUsuario, fecha);

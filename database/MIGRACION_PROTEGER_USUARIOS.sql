-- Aplicar una vez, con escrituras pausadas, después de las migraciones de vínculos y sesiones.
-- Primero se añaden restricciones validadas y luego se retiran solo las claves redundantes.
-- Este archivo no borra filas ni deshabilita las comprobaciones de claves foráneas.

ALTER TABLE Ingreso
  ADD CONSTRAINT FK_Ingreso_Usuario_Protegido FOREIGN KEY (idUsuario)
  REFERENCES Usuario (idUsuario) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE Egreso
  ADD CONSTRAINT FK_Egreso_Usuario_Protegido FOREIGN KEY (idUsuario)
  REFERENCES Usuario (idUsuario) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE Presupuesto
  ADD CONSTRAINT FK_Presupuesto_Usuario_Protegido FOREIGN KEY (idUsuario)
  REFERENCES Usuario (idUsuario) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE Reporte
  ADD CONSTRAINT FK_Reporte_Usuario_Protegido FOREIGN KEY (idUsuario)
  REFERENCES Usuario (idUsuario) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE Mensaje
  ADD CONSTRAINT FK_Mensaje_Emisor_Protegido FOREIGN KEY (idEmisor)
  REFERENCES Usuario (idUsuario) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE Mensaje
  ADD CONSTRAINT FK_Mensaje_Receptor_Protegido FOREIGN KEY (idReceptor)
  REFERENCES Usuario (idUsuario) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE Notificacion
  ADD CONSTRAINT FK_Notificacion_Usuario_Protegido FOREIGN KEY (idUsuario)
  REFERENCES Usuario (idUsuario) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE Suscripcion
  ADD CONSTRAINT FK_Suscripcion_Usuario_Protegido FOREIGN KEY (idUsuario)
  REFERENCES Usuario (idUsuario) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE HistorialActividad
  ADD CONSTRAINT FK_HistorialActividad_Usuario_Protegido FOREIGN KEY (idUsuario)
  REFERENCES Usuario (idUsuario) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ClienteContador
  ADD CONSTRAINT FK_Vinculo_Contador_Protegido FOREIGN KEY (idContador)
  REFERENCES Usuario (idUsuario) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ClienteContador
  ADD CONSTRAINT FK_Vinculo_Cliente_Protegido FOREIGN KEY (idCliente)
  REFERENCES Usuario (idUsuario) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE Ingreso DROP FOREIGN KEY FK_Ingreso_Usuario;
ALTER TABLE Egreso DROP FOREIGN KEY FK_Egreso_Usuario;
ALTER TABLE Presupuesto DROP FOREIGN KEY FK_Presupuesto_Usuario;
ALTER TABLE Reporte DROP FOREIGN KEY FK_Reporte_Usuario;
ALTER TABLE Mensaje DROP FOREIGN KEY FK_Mensaje_Emisor;
ALTER TABLE Mensaje DROP FOREIGN KEY FK_Mensaje_Receptor;
ALTER TABLE Notificacion DROP FOREIGN KEY FK_Notificacion_Usuario;
ALTER TABLE Suscripcion DROP FOREIGN KEY FK_Suscripcion_Usuario;
ALTER TABLE HistorialActividad DROP FOREIGN KEY FK_Historial_Usuario;
ALTER TABLE ClienteContador DROP FOREIGN KEY FK_Vinculo_Contador;
ALTER TABLE ClienteContador DROP FOREIGN KEY FK_Vinculo_Cliente;

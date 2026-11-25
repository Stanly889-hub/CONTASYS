-- Solo lectura. Ejecutar con el esquema de CONTASYS seleccionado.
-- Un resultado Revisar indica ausencia o incompatibilidad en un objeto clave.
WITH controles AS (
    SELECT 'Base' AS migracion, 'Usuario / Ingreso / Egreso / vista de balance' AS control, (
        SELECT COUNT(*) = 4 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('Usuario','Ingreso','Egreso','vw_balance_por_usuario')
    ) AS compatible
    UNION ALL SELECT 'Roles y Premium','Clave única de ClienteContador',
        EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'ClienteContador' AND INDEX_NAME = 'UQ_Vinculo'
            GROUP BY INDEX_NAME HAVING MIN(NON_UNIQUE) = 0
            AND GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) = 'idContador,idCliente')
    UNION ALL SELECT 'Sesiones','Expiración, revocación e índice',
        (SELECT COUNT(*) = 2 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Sesion'
            AND ((COLUMN_NAME = 'expiraUnix' AND DATA_TYPE = 'bigint') OR (COLUMN_NAME = 'revocada' AND DATA_TYPE = 'tinyint')))
        AND EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'Sesion' AND INDEX_NAME = 'IDX_Sesion_Expiracion' AND COLUMN_NAME = 'expiraUnix')
    UNION ALL SELECT 'Protección de usuarios','11 referencias restrictivas sin cascada',
        (SELECT COUNT(*) = 11 FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE()
            AND REFERENCED_TABLE_NAME = 'Usuario' AND RIGHT(CONSTRAINT_NAME,10) = '_Protegido' AND DELETE_RULE = 'RESTRICT')
        AND NOT EXISTS (SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE()
            AND REFERENCED_TABLE_NAME = 'Usuario' AND DELETE_RULE = 'CASCADE')
    UNION ALL SELECT 'Protección de vínculos','Estados y trigger de suspensión',
        EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ClienteContador'
            AND COLUMN_NAME = 'estado' AND COLUMN_TYPE LIKE '%Suspendido%Revocado%')
        AND EXISTS (SELECT 1 FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE()
            AND TRIGGER_NAME = 'TR_Usuario_SuspenderVinculos' AND EVENT_OBJECT_TABLE = 'Usuario'
            AND ACTION_TIMING = 'AFTER' AND EVENT_MANIPULATION = 'UPDATE')
    UNION ALL SELECT 'Alertas','Clave por presupuesto y tipo',
        EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'EventoPresupuesto' AND INDEX_NAME = 'PRIMARY'
            GROUP BY INDEX_NAME HAVING GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) = 'idPresupuesto,tipo')
    UNION ALL SELECT 'Tipo de categoría','Trigger de conservación del tipo',
        EXISTS (SELECT 1 FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE()
            AND TRIGGER_NAME = 'TR_Categoria_ConservarTipo' AND EVENT_OBJECT_TABLE = 'CategoriaFinanciera'
            AND ACTION_TIMING = 'BEFORE' AND EVENT_MANIPULATION = 'UPDATE')
    UNION ALL SELECT 'Facturación','Consecutivo único, ingreso único y clave de detalle',
        (SELECT COUNT(*) = 3 FROM (
            SELECT TABLE_NAME, INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE()
            AND NON_UNIQUE = 0 AND TABLE_NAME IN ('Factura','FacturaDetalle')
            GROUP BY TABLE_NAME, INDEX_NAME HAVING
                (TABLE_NAME = 'Factura' AND INDEX_NAME = 'UQ_Factura_Consecutivo'
                 AND GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) = 'idUsuario,consecutivo')
                OR (TABLE_NAME = 'Factura' AND INDEX_NAME = 'UQ_Factura_Ingreso'
                 AND GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) = 'idIngreso')
                OR (TABLE_NAME = 'FacturaDetalle' AND INDEX_NAME = 'PRIMARY'
                 AND GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) = 'idFactura,revision,renglon')
        ) claves)
    UNION ALL SELECT 'Conciliación','Borradores, permiso y trigger de revocación',
        (SELECT COUNT(*) = 4 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
            AND ((TABLE_NAME = 'Factura' AND COLUMN_NAME IN ('fecha','receptorNombre','borradorDatos') AND IS_NULLABLE = 'YES')
                OR (TABLE_NAME = 'ClienteContador' AND COLUMN_NAME = 'facturasAutorizadas' AND DATA_TYPE = 'tinyint')))
        AND EXISTS (SELECT 1 FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE()
            AND TRIGGER_NAME = 'TR_Vinculo_RevocarFacturas' AND EVENT_OBJECT_TABLE = 'ClienteContador'
            AND ACTION_TIMING = 'BEFORE' AND EVENT_MANIPULATION = 'UPDATE')
    UNION ALL SELECT 'Corrección de pagos','Origen, auditoría y referencias restrictivas',
        (SELECT COUNT(*) = 3 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PagoFactura'
            AND ((COLUMN_NAME = 'origen' AND COLUMN_TYPE LIKE '%Facturacion%Conciliacion%')
                OR (COLUMN_NAME IN ('corregidoEn','motivoCorreccion') AND IS_NULLABLE = 'YES')))
        AND (SELECT COUNT(*) = 5 FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE()
            AND TABLE_NAME = 'PagoFactura' AND DELETE_RULE = 'RESTRICT')
), indices AS (
    SELECT 'Ingreso' tabla, 'IDX_Ingreso_Usuario_Fecha' indice, 'idUsuario,fecha' columnas
    UNION ALL SELECT 'Egreso','IDX_Egreso_Usuario_Fecha','idUsuario,fecha'
    UNION ALL SELECT 'Ingreso','IDX_Ingreso_Ejecucion','idUsuario,idCategoria,estadoTransaccion,fecha,monto'
    UNION ALL SELECT 'Egreso','IDX_Egreso_Ejecucion','idUsuario,idCategoria,estadoTransaccion,fecha,monto'
    UNION ALL SELECT 'Mensaje','IDX_Mensaje_Conversacion','idEmisor,idReceptor'
    UNION ALL SELECT 'Mensaje','IDX_Mensaje_Pendientes','idReceptor,leido,idEmisor'
    UNION ALL SELECT 'Notificacion','IDX_Notificacion_Usuario_Fecha','idUsuario,fecha'
    UNION ALL SELECT 'Notificacion','IDX_Notificacion_Pendientes','idUsuario,estado'
    UNION ALL SELECT 'HistorialActividad','IDX_Historial_Usuario_Fecha','idUsuario,fecha'
)
SELECT migracion, control, IF(compatible, 'Compatible', 'Revisar') AS resultado FROM controles
UNION ALL
SELECT 'Rendimiento', i.indice, IF(EXISTS (
    SELECT 1 FROM information_schema.STATISTICS s WHERE s.TABLE_SCHEMA = DATABASE()
    AND s.TABLE_NAME = i.tabla AND s.INDEX_NAME = i.indice
    GROUP BY s.INDEX_NAME HAVING GROUP_CONCAT(s.COLUMN_NAME ORDER BY s.SEQ_IN_INDEX) = i.columnas
), 'Compatible', 'Revisar')
FROM indices i;

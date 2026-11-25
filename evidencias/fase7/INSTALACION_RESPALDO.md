# Instalación, permisos y respaldo · Fase 7

## Instalación y actualización

1. Usa Node.js 22 para reproducir toda la suite, incluido Cypress 16, y MySQL con las funciones SQL verificadas por el diagnóstico. La ejecución de esta fase se hizo con Node 22.16.0 y MySQL 26.7.0.
2. Desde la raíz y desde `backend/`, instala con `npm ci`. En Windows PowerShell se puede usar `npm.cmd ci`. Las bibliotecas de navegador están en `vendor/` con sus licencias y no requieren CDN durante la ejecución.
3. Desde Workbench, selecciona el esquema y confirma con `SELECT DATABASE();`. En una instalación nueva aplica el esquema base y las migraciones en el orden del README del backend. En una actualización aplica solo los pasos pendientes después de ejecutar `DIAGNOSTICO_MIGRACIONES.sql`. Las sentencias que alteran columnas, crean triggers o agregan índices se ejecutan una vez. Revisa los objetos si se interrumpe una migración.
4. Para adoptar una cuenta limitada, créala en **Users and Privileges** con el host real del backend y una contraseña propia. Aplica la plantilla [PERMISOS_CONTASYS_APP.sql](../../database/PERMISOS_CONTASYS_APP.sql) sobre el esquema correcto y verifica `SHOW GRANTS`. La cuenta operativa de migración y respaldo es independiente.
5. Solo después de validar la cuenta nueva actualiza `DB_USER` y `DB_PASSWORD` en tu entorno privado. Conserva el secreto JWT actual salvo una rotación autorizada. Publica juntos frontend y backend, incluida la carpeta `vendor/`. Verifica `/api/salud`, el inicio de sesión y una operación de lectura. En un entorno comercial usa `NODE_ENV=production` para impedir pagos simulados.

## Respaldo y restauración

Para respaldar una instalación real, usa una cuenta operativa y guarda el archivo fuera de Git, con permisos restringidos. En Workbench, **Data Export** permite seleccionar el esquema y exportar a un archivo autocontenido. Si el archivo incluye instrucciones de cambio de esquema o reemplazo, revísalas antes de cualquier restauración. Restaura primero en un esquema nuevo de verificación.

La prueba automatizada usa un respaldo lógico de datos con `mysqldump --single-transaction --no-create-info`. Construye primero el esquema de destino con las migraciones, carga los datos con el cliente `mysql` y compara las filas ordenadas por clave primaria mediante SHA-256. El verificador solo acepta esquemas ficticios generados por la suite.

```powershell
cd backend
$env:CONTASYS_MYSQL_BIN = 'C:\Program Files\MySQL\MySQL Server 26.7\bin'
node scripts/verificar-restauracion.js NOMBRE_DEL_ESQUEMA_FICTICIO
```

Prueba ejecutada desde `contasys_prueba_auth_d8c56e7356b2` a `contasys_prueba_restaurada_677a9136fd`. Se verificaron las **18 tablas completas**, incluidas 24 cuentas, 24 suscripciones, 23 ingresos, 5 egresos, 12 facturas, 6 pagos, 15 presupuestos, 5 mensajes y 26 notificaciones. El diagnóstico de migraciones resultó compatible en el esquema restaurado. Los datos de respaldo quedaron en una carpeta temporal, fuera del repositorio.

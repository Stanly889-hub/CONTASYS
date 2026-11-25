# Backend de CONTASYS

API REST con Node.js, Express y MySQL. Los datos de negocio se almacenan en MySQL. El navegador conserva el JWT en `localStorage`.

## Requisitos

- Node.js 22 para reproducir la suite completa y Cypress 16.
- MySQL con CTE, restricciones `CHECK` e InnoDB. La fase 7 se verificó sobre MySQL 26.7.0. Si usas MariaDB u otra versión, valida primero sus migraciones en un esquema independiente.

## Instalación

1. Instala las dependencias:
   ```bash
   npm ci
   ```

2. Copia el archivo de variables de entorno de ejemplo:
   ```bash
   cp .env.example .env
   ```

3. Abre `.env` y ajusta los valores a tu entorno local (usuario y contraseña de tu MySQL, nombre de la base de datos). Si tu MySQL local no tiene contraseña para `root`, deja `DB_PASSWORD=` vacío.

4. Sigue el procedimiento de instalación nueva o actualización de la sección de base de datos.

5. Inicia el servidor:
   ```bash
   npm run dev
   ```
   (usa `npm start` si no quieres que se reinicie solo al guardar cambios)

6. Deberías ver en la consola: `CONTASYS API escuchando en http://localhost:3000`

## Seguridad y autenticación

### Despliegue de autenticación

1. Completa las migraciones de base de datos antes de arrancar el backend actualizado.
2. Conserva las credenciales existentes. Una instalación nueva requiere su propio `JWT_SECRET` aleatorio y privado. Si una instalación existente usa un secreto compartido o publicado, programa su rotación con autorización.
3. En producción establece `NODE_ENV=production`. Deja `CORS_ORIGIN` vacío si frontend y API comparten origen. Para un frontend separado, declara los orígenes HTTPS exactos, separados por comas y sin barra final. En desarrollo se permiten `http://localhost:5500` y `http://127.0.0.1:5500`; cualquier puerto adicional se declara explícitamente. CORS regula el acceso desde el navegador. Cada petición protegida requiere una sesión válida.
4. Publica juntos el frontend y el backend y pide a los usuarios iniciar sesión una vez. Los tokens emitidos antes de esta fase carecen de un identificador de sesión y se rechazan. El cambio conserva los usuarios, sus contraseñas y el plan asignado.

### Primer administrador

El registro público admite Contador y Emprendedor. En una instalación sin administradores, ejecuta desde `backend/`:

```sh
node scripts/crear-primer-administrador.js
```

Usa una terminal interactiva en el entorno con acceso autorizado a MySQL. El comando pide confirmar el nombre de la base, solicita los datos de la nueva cuenta y oculta la contraseña mientras se escribe. Crea la cuenta y su suscripción Free en una transacción. Si ya existe un Administrador, incluso inactivo, el comando se detiene sin crear otra cuenta. Los administradores existentes siguen gestionando roles desde el panel.

### Sesiones y propuesta de almacenamiento

La API comprueba en MySQL que cada sesión esté vigente y que su usuario siga activo. El rol se obtiene de la cuenta actual. Cerrar sesión revoca el token utilizado y desactivar una cuenta revoca todas sus sesiones existentes. Las peticiones que ya habían superado la autorización antes del cambio pueden terminar. Los cambios de rol y estado se confirman junto con su registro de actividad.

El JWT se conserva en `localStorage` para mantener el flujo actual. Los scripts ejecutados en el mismo origen pueden leerlo, incluidos los scripts de terceros que se carguen en las páginas. Para una fase posterior, se propone servir frontend y API bajo el mismo origen y guardar la sesión en una cookie `HttpOnly`, `Secure` y con `SameSite` adecuado, manteniendo la revocación en el servidor. Requiere protección CSRF para operaciones de escritura, adaptar el cliente HTTP y las pruebas, verificar el proxy HTTPS y coordinar otro inicio de sesión. Si se mantienen orígenes separados, también requiere configurar explícitamente las credenciales de CORS y probar la política de cookies del navegador.

El limitador local conserva hasta 10.000 claves de IP y correo, expira las entradas y devuelve `429` cuando se alcanza el cupo aplicable. En instalaciones con varias réplicas conviene compartir ese estado.

## Base de datos

### Instalación nueva en MySQL Workbench

1. Crea un esquema vacío con juego de caracteres `utf8mb4` e intercalación `utf8mb4_unicode_ci`. Para una prueba manual, usa un nombre independiente de producción.
2. Haz doble clic en ese esquema en **Schemas** y ejecuta `SELECT DATABASE();` para verificar la selección.
3. Abre y ejecuta estos archivos completos, en orden, desde la misma conexión y sobre el mismo esquema.

   1. `database/CONTASYS_PRODUCCION.sql` crea el esquema base, los catálogos, los triggers y las vistas. Se ejecuta una vez sobre un esquema vacío.
   2. `database/MIGRACION_ROLES_PREMIUM.sql` añade `ClienteContador`.
   3. `database/MIGRACION_SESIONES.sql` añade `Sesion`.
   4. `database/MIGRACION_PROTEGER_USUARIOS.sql` sustituye las cascadas desde usuarios por restricciones de borrado.
   5. `database/MIGRACION_PROTEGER_VINCULOS.sql` habilita estados de protección y la suspensión por cambio de rol.
   6. `database/MIGRACION_ALERTAS_PRESUPUESTO.sql` agrega el registro de eventos de presupuesto.
   7. `database/MIGRACION_TIPO_CATEGORIA.sql` protege el tipo de las categorías existentes.
   8. `database/MIGRACION_FACTURACION.sql` agrega las facturas y sus detalles.
   9. `database/MIGRACION_FACTURAS_CONCILIACION.sql` habilita borradores incompletos y añade el permiso de facturas al vínculo.
   10. `database/MIGRACION_CORRECCION_PAGOS.sql` añade el historial verificable de pagos y correcciones.
   11. `database/MIGRACION_RENDIMIENTO.sql` agrega los índices medidos para listados, chat y agregaciones.

4. Configura `DB_NAME` para esa instalación, inicia el backend y consulta `/api/salud`. Usa el comando de alta del primer administrador si corresponde. Para datos ficticios, aplica `database/pruebas/DATOS_DEMO.sql` exclusivamente a un esquema de pruebas recién instalado y vacío de usuarios, antes de dar altas. Los hashes de demostración son marcadores y no permiten iniciar sesión.

### Actualización de una base existente

1. Prepara una copia de respaldo y verifica el esquema seleccionado con `SELECT DATABASE();`. Tanto `contasys_actualizado` como `contasys_produccion` usan los mismos archivos y cada ejecución actúa solo sobre el esquema seleccionado.
2. Aplica las migraciones pendientes respetando el orden de instalación. Las dos primeras se pueden repetir sobre un esquema compatible. Las dos de protección se aplican una vez, con las escrituras pausadas y antes de publicar el backend actualizado. En caso de interrupción, revisa las claves con `SHOW CREATE TABLE` y el trigger con `SHOW TRIGGERS`, y continúa desde la primera sentencia pendiente. MySQL confirma cada cambio de esquema por separado. La migración de usuarios añade primero las claves restrictivas y retira después las claves antiguas. Las comprobaciones de claves foráneas permanecen activas.
3. Ejecuta `DIAGNOSTICO_INTEGRIDAD.sql` para identificar cuentas sin suscripción y revisar anomalías. Si aparecen cuentas sin plan y corresponde asignarles Free, ejecuta `RECUPERAR_SUSCRIPCIONES.sql` y repite el diagnóstico. El procedimiento inserta únicamente las suscripciones ausentes, con vigencia de un año, y deja intactos los planes existentes, incluidos los cancelados y vencidos.
4. Reinicia el backend y comprueba `/api/salud`. Responde HTTP 200 si MySQL y los objetos requeridos son consultables, o HTTP 503 con un mensaje genérico si la comprobación falla.

### Retención controlada de sesiones

Conserva las filas de sesión durante al menos 30 días desde su vencimiento. La depuración se ejecuta por decisión del operador, en lotes de hasta 200 filas, y actúa exclusivamente sobre `Sesion`. Conserva `HistorialActividad`, incluidas las entradas de inicio de sesión y las operaciones administrativas.

Desde la terminal de Visual Studio Code, en `backend/`, ejecuta primero `node scripts/retener-sesiones.js` para obtener el conteo. Para aplicar un solo lote usa `node scripts/retener-sesiones.js --aplicar NOMBRE_ESQUEMA` con el nombre exacto configurado en `DB_NAME`. Revisa el resultado antes de repetir. El trabajo no se ejecuta automáticamente.

### Revisión de integridad y propuesta de borrado

- Ingresos y egresos tienen claves foráneas para usuario, categoría y método de pago, un control de monto positivo y triggers que validan el tipo de categoría al insertar o editar. Cambiar directamente el tipo de una categoría puede invalidar movimientos previos. El estado activo de los catálogos requiere una decisión funcional sobre el tratamiento de movimientos históricos.
- Presupuestos admiten categorías de ingresos y egresos y validan monto y orden de fechas. Categorías y métodos tienen claves únicas. Mensajes tienen claves foráneas para ambos participantes y triggers contra el autoenvío.
- Vínculos tienen una clave única por pareja. Los estados `Pendiente` y `Aceptado` cuentan para el cupo de Free. Una cuenta inactiva bloquea la consulta mientras dure la desactivación. Al reactivarla, una aceptación previa vuelve a ser válida si ambos roles siguen siendo compatibles y el vínculo sigue aceptado.
- Un cambio a un rol incompatible suspende los vínculos pendientes o aceptados y registra el hecho para ambos participantes. El trigger también se aplica a cambios directos de rol en MySQL. Recuperar el rol compatible mantiene el vínculo suspendido hasta que el contador vuelva a solicitar acceso y el emprendedor lo acepte. Quitar un vínculo lo marca como `Revocado` y lo retira de la vista habitual, conservando la fila y su historial.
- MySQL indexa las claves foráneas. Sesiones tiene su índice de expiración, y vínculos tiene su índice único y el índice de la clave foránea del cliente. Los índices compuestos para consultas financieras deben evaluarse con planes de ejecución y datos representativos.
- Con la migración de protección aplicada, las referencias desde ingresos, egresos, presupuestos, reportes, mensajes, notificaciones, suscripciones, historial, vínculos y sesiones impiden borrar por SQL una cuenta referenciada. La administración ordinaria sigue usando desactivación y reactivación.

### Cuenta MySQL de la aplicación

En **Users and Privileges**, crea una cuenta nueva limitada al host real del backend y asígnale un secreto propio. Deja vacía la sección de privilegios administrativos y aplica únicamente estos permisos en el esquema de CONTASYS:

| Permiso | Objetos |
|---|---|
| `SELECT` | Las 18 tablas del esquema y `vw_balance_por_usuario` |
| `INSERT` | `Usuario`, `Suscripcion`, `Sesion`, `CategoriaFinanciera`, `MetodoPago`, `Ingreso`, `Egreso`, `Presupuesto`, `Mensaje`, `Notificacion`, `ClienteContador`, `HistorialActividad`, `EventoPresupuesto`, `Factura`, `FacturaDetalle`, `PagoFactura` |
| `UPDATE` | `Usuario`, `Suscripcion`, `Sesion`, `CategoriaFinanciera`, `MetodoPago`, `Ingreso`, `Egreso`, `Presupuesto`, `Mensaje`, `Notificacion`, `ClienteContador`, `Factura`, `PagoFactura` |
| `DELETE` | Únicamente `Ingreso`, `Egreso` y `Presupuesto`, para las acciones existentes de la interfaz |

Otorga estos permisos por tabla o vista. Evita asignar permisos de escritura a todo el esquema, roles amplios o `GRANT OPTION`. En Workbench puedes usar una pestaña SQL con sentencias como `GRANT SELECT, INSERT, UPDATE ON nombre_esquema.Usuario TO 'contasys_app'@'localhost';`, ajustando el destino y el host. Verifica los permisos efectivos con `SHOW GRANTS`. Prueba la cuenta en un esquema independiente antes de actualizar `DB_USER` y `DB_PASSWORD` en el entorno de despliegue. Conserva una cuenta operativa separada para ejecutar DDL y depurar sesiones. Las vistas y triggers deben mantener un definidor válido con los permisos que requieren.

## Criterios financieros

- Dashboard, reportes, análisis y presupuestos solo usan movimientos confirmados para sus importes reales. Los pendientes se presentan aparte y los anulados permanecen identificados en las listas y el detalle del reporte.
- El dashboard conserva su alcance de todas las fechas. Reportes usa el rango inclusivo elegido, incluso si se consulta un periodo futuro. Análisis usa la fecha actual de MySQL como cierre para ambos planes. Free comienza el primer día del mes de hace dos meses y Premium cubre todo el historial hasta ese cierre. En consulta delegada, análisis conserva el plan del contador.
- Las sumas se calculan con `DECIMAL` en MySQL o enteros de centavos. Los importes se devuelven como cadenas decimales con dos cifras. El porcentaje de ejecución y la tasa de ahorro se redondean al entero más cercano, con los empates alejándose de cero. Una base de cálculo nula o igual a cero produce un 0 %. Las pantallas conservan su formato COP en pesos enteros y los archivos exportados conservan los centavos. Excel guarda como texto los importes que exceden su precisión numérica.
- El presupuesto de ingresos compara la recaudación confirmada con la meta. El de egresos resta el gasto confirmado del límite. En ambos, la diferencia es el importe presupuestado menos el ejecutado para la categoría, el usuario y el periodo.
- Las altas y ediciones validan fechas, montos, estados y catálogos. Una edición puede conservar su referencia histórica a una categoría o método desactivado. Una categoría incompatible sigue siendo inválida. En una edición por API, omitir el estado conserva el estado anterior.
La fase 3 no requirió migración adicional. Las pruebas verifican API y MySQL en esquemas aislados y los datos entregados a los exportadores del navegador con dobles de prueba.

## Presupuestos, clientes y notificaciones

### Cupo y alertas

- Free admite tres presupuestos con estado `Activo` y fecha final igual o posterior al día actual de MySQL. Un presupuesto activo con inicio futuro reserva cupo. Los vencidos, finalizados o cancelados no consumen cupo. Las ediciones que cambian de un estado sin cupo a uno que lo consume pasan por la misma comprobación que un alta. Al pasar de Premium a Free se conservan los presupuestos previos. Se pueden editar los que ya consumen cupo y se bloquea cualquier incremento mientras se esté en el límite o por encima.
- La aplicación serializa las escrituras de presupuestos, movimientos y cambios de plan por propietario. Los GET de presupuestos no escriben. Las altas y ediciones de presupuesto y las mutaciones de movimientos reevalúan los presupuestos afectados en la misma transacción. Se comprueban la categoría y fecha anteriores y las nuevas al mover o cambiar el estado de un movimiento.
- Solo se emiten alertas cuando el presupuesto está activo y el día actual está dentro de su periodo. La ejecución conserva el criterio de movimientos confirmados dentro del periodo completo. No se programan alertas por el mero paso del tiempo. La próxima escritura pertinente reevalúa el presupuesto.
- Para ambos planes se informa la meta de ingresos alcanzada, el límite de egresos alcanzado exactamente o el límite de egresos superado. Premium agrega una alerta preventiva desde el 80 % exacto hasta antes del 100 %. Un salto que cruza varios umbrales emite el evento correspondiente al resultado de la escritura.
- Se conserva un solo evento por presupuesto y tipo durante toda la vida del presupuesto. Bajar y volver a cruzar el umbral, editar el nombre, marcar una alerta como vista o archivarla no habilita otra del mismo tipo. El identificador del presupuesto queda en el evento si el titular usa la acción existente de eliminar un presupuesto. Las notificaciones anteriores a la migración conservan sus estados. Como carecen de identificador de presupuesto, no se asignan retroactivamente y el próximo evento puede producir una primera alerta identificada.

### Planes y privacidad en consultas delegadas

La sesión delegada identifica al cliente seleccionado y solo permite lecturas financieras. El navegador descarta respuestas de una selección anterior y recarga las pantallas financieras al cambiar el cliente en otra pestaña o recuperar una página del historial. Las notificaciones son privadas de la cuenta autenticada. El contador de pendientes se actualiza al abrir la vista, recuperar el foco y completar operaciones que pueden afectar el conteo, y cada 30 segundos mientras la página está visible.

El cupo y las alertas de presupuestos dependen del plan del propietario. Análisis conserva la ventana del plan del contador al consultar a un cliente. Reportes mantiene el rango manual y PDF para ambos planes. Excel conserva el beneficio de la cuenta que consulta. Aplicar al historial visible el plan del cliente además del plan del contador cambiaría los datos actualmente disponibles para contadores Premium. Cualquier cambio de esa política requiere una decisión comercial separada.

### Actualización

Sobre una base con las fases anteriores aplicadas, selecciona el esquema en Workbench, pausa las escrituras y aplica `MIGRACION_ALERTAS_PRESUPUESTO.sql` seguida de `MIGRACION_TIPO_CATEGORIA.sql`. La segunda se ejecuta una sola vez. Los tipos de categorías existentes quedan fijos para proteger el historial. Para un tipo diferente se crea una categoría nueva. La activación y desactivación de catálogos siguen disponibles. Actualiza los permisos por tabla si usas la cuenta de aplicación y publica juntos frontend y backend.

## Facturación y suscripciones

La factura es un documento comercial interno o de demostración académica. Su consecutivo `FAC-` pertenece a la cuenta emisora. El módulo funciona con ambos planes. El receptor se captura en el documento y es independiente de las relaciones contador-cliente.

- `Factura` guarda propietario, consecutivo único por cuenta, revisión, estado, fechas, importes y copias del nombre, documento y correo del emisor y el nombre y documento opcional del receptor. `FacturaDetalle` guarda cada renglón y cada revisión del borrador. Las claves foráneas protegen las referencias. El historial filtra por fecha del documento, estado, número, nombre o documento del receptor. Los indicadores corresponden al filtro aplicado. Total facturado suma pendientes y pagadas, y cantidad incluye todos los estados que coincidan.
- Borrador puede emitirse a Pendiente o anularse. Pendiente puede pasar a Pagada o Anulada. Anulada es terminal. Una Pagada vuelve a Pendiente únicamente mediante la corrección interna de un pago con origen verificable. Solo se editan borradores. Pueden guardarse con campos vacíos y total cero. Los renglones incompletos se conservan en el borrador y no contribuyen al total preliminar. La emisión exige fecha, receptor, renglones completos y total positivo. Los documentos anteriores se conservan.
- Cada línea admite hasta tres decimales en cantidad y dos en precio unitario, descuento porcentual e impuesto porcentual. El backend calcula subtotal bruto, aplica el descuento y calcula el impuesto sobre la base descontada. Redondea cada etapa a centavos, con mitades hacia arriba, y suma los importes de línea.
- Para pagar hay dos opciones. Crear un ingreso confirmado con fecha actual de MySQL y catálogos activos, o confirmar la asociación de un ingreso propio, confirmado, aún libre y del mismo importe exacto. En la conciliación, la fecha del ingreso debe estar entre la fecha del documento y el día actual de MySQL, inclusive. Se conserva el ingreso íntegro y su fecha se usa como fecha de pago. Ambas opciones usan una transacción y un vínculo único. La API impide editar o borrar por separado un ingreso vinculado. La conciliación queda en el historial y deja el balance intacto.
- Desde **Mi cuenta**, un Emprendedor puede autorizar o revocar la lectura de facturas para un vínculo aceptado. Con ese permiso, el Contador puede ver historial, indicadores, detalle y descargar PDF de documentos emitidos del cliente seleccionado. Los borradores permanecen privados. El PDF se regenera con los datos guardados y vuelve a comprobar el permiso al descargar. Suspender o revocar el vínculo elimina el permiso y exige una nueva autorización. La inactividad de cualquiera de las cuentas bloquea la consulta mientras dure.

### Corrección interna de pagos

Cada pago nuevo guarda en `PagoFactura` un ID propio, el origen, el ingreso relacionado, el importe, la fecha y los catálogos originales. La opción **Corregir pago** exige motivo y confirmación explícita. La factura vuelve a Pendiente. Si el ingreso se generó desde facturación, queda anulado y sale de los saldos confirmados. Si se trata de un ingreso conciliado, conserva su estado y sus datos, y se puede conciliar con la factura correcta. La corrección no mueve dinero.

La operación bloquea la cuenta, la factura, el pago y el ingreso. Guarda el motivo, el actor y la fecha de una única corrección por ID de pago. También reevalúa el presupuesto y conserva la deduplicación de alertas. Un pago posterior recibe un ID nuevo. Las solicitudes atrasadas que indiquen un ID anterior se rechazan. El titular ve los pagos anteriores y sus motivos. La vista delegada conserva los documentos emitidos y omite el historial interno de correcciones.

La migración conserva los pagos anteriores sin inferir su origen. Si una factura pagada no tiene una entrada verificable en `PagoFactura`, su corrección automática queda bloqueada. Los pagos parciales, abonos y devoluciones comerciales siguen fuera del alcance.

### Vigencia y simulación

Premium requiere una suscripción activa cuya fecha de inicio y fin incluyan hoy. Una activación simulada inicia un mes de vigencia. Una renovación vigente suma un mes a la fecha final existente. Un Premium vencido vuelve a iniciar desde hoy al contratar de nuevo. Volver a Free conserva facturas, presupuestos y clientes. Las suscripciones existentes conservan sus fechas y adquieren beneficios según su vigencia.

`NODE_ENV=production` bloquea la activación y renovación simuladas incluso cuando `CONTASYS_SIMULAR_PAGOS=true`. En desarrollo se puede deshabilitar la simulación con `CONTASYS_SIMULAR_PAGOS=false`. La API identifica la operación como simulada y conserva el precio mostrado de $19.900 COP mensuales. El backend publica los beneficios del plan efectivo y la interfaz usa ese dato para habilitar Excel. Los reportes accesibles en JSON se pueden convertir con herramientas externas.

### Actualización

Selecciona en Workbench el esquema de destino y pausa las escrituras. Aplica las migraciones pendientes de facturación en orden. Si ya están aplicadas la inicial y la de conciliación, ejecuta solo `database/MIGRACION_CORRECCION_PAGOS.sql`. Si usas la cuenta de aplicación, agrega `SELECT`, `INSERT` y `UPDATE` sobre `PagoFactura`. Reinicia el backend, comprueba `/api/salud` y publica el frontend actualizado.

Para ejecutar la comprobación móvil a 375 px y la descarga binaria, usa Node.js 22 y define `CONTASYS_NAVEGADOR` con la ruta a un ejecutable Chromium. La prueba usa jsPDF 4.2.1 desde `vendor/`; `CONTASYS_JSPDF` permite señalar otra copia de la misma versión. Ejecuta `npm.cmd test` desde `backend/`. Las pruebas del navegador usan datos ficticios y perfiles temporales.

Para probar el PDF con una factura realmente corregida, define `CONTASYS_FACTURA_CORREGIDA` con una ruta JSON temporal. Ejecuta primero la suite con `CONTASYS_PRUEBA_MYSQL=1`, sin las variables del navegador. La integración guarda allí la factura ficticia recuperada después de la corrección. Después ejecuta `node --test test/facturas-ui.test.js` con las variables de Chromium y jsPDF, manteniendo la ruta JSON.

## Rendimiento y estabilidad

- Movimientos, facturas, notificaciones e historial admiten `limite` de 1 a 100 y un `cursor` devuelto como `siguiente`. Conserva el mismo filtro al usar el cursor. La interfaz solicita 50 filas, o 10 en el historial. Movimientos y facturas conservan sus indicadores globales. Los consumidores previos pueden omitir los parámetros para conservar sus respuestas originales. La tabla de reportes dibuja 100 filas por página y la API sigue devolviendo el detalle completo para exportar.
- Chat carga primero los mensajes recientes y admite `antes` o `despues` con IDs. La interfaz pausa el sondeo al quedar oculta, descarta respuestas al cambiar de contacto y evita sondeos superpuestos. Los contactos se refrescan como máximo cada 20 segundos en el sondeo periódico. Los envíos a una cuenta inactiva son rechazados.
- El pool admite diez conexiones y cien peticiones en espera. La conexión inicial a MySQL y la adquisición para una transacción tienen límites de cinco segundos. El servidor drena solicitudes al recibir `SIGINT` o `SIGTERM`, con un máximo de 15 segundos. Los mensajes de errores de la API evitan incluir credenciales, tokens, cuerpos y objetos SQL.

### Evaluador de alertas

El trabajo es optativo. `CONTASYS_ALERTAS_INTERVALO_MS=0` lo desactiva. Para activar, configura por ejemplo `60000` y `CONTASYS_ALERTAS_LOTE=25`. Se aceptan lotes de 1 a 100. Busca presupuestos y cuentas activos cuyo periodo incluye el día actual de MySQL. Esto recupera los presupuestos todavía vigentes que empezaron durante una interrupción. Avanza por ID y reinicia al cambiar de fecha o reiniciar el proceso. Usa las reglas de alertas y la deduplicación existentes, incluso en varias instancias. La retención de sesiones mantiene su procedimiento independiente.

### Diagnóstico y despliegue

1. En Workbench, selecciona el esquema, confirma con `SELECT DATABASE();` y ejecuta [DIAGNOSTICO_MIGRACIONES.sql](../database/DIAGNOSTICO_MIGRACIONES.sql). Usa una cuenta con visibilidad de metadatos y triggers. Se verifican firmas de columnas, triggers, restricciones e índices. `Revisar` indica que la firma está ausente o difiere. Este diagnóstico comprueba objetos clave y no sustituye un historial formal de despliegues.
2. Prepara un respaldo y aplica solo las migraciones pendientes. Si las fases anteriores están completas, ejecuta `MIGRACION_RENDIMIENTO.sql`. Es aditiva y se aplica una vez. Si se interrumpe, revisa las firmas y continúa con las sentencias `CREATE INDEX` que falten.
3. Publica juntos frontend y backend, comprueba `/api/salud` y decide si habilitas el evaluador. Los permisos de la cuenta de aplicación se conservan.

El esquema base se ejecuta una vez sobre un esquema vacío. Las migraciones de protección de usuarios, protección de vínculos, tipo de categoría, conciliación y rendimiento también se aplican una vez. Los scripts de creación con `IF NOT EXISTS` pueden repetirse sobre estructuras compatibles.

Consulta [Rendimiento](../docs/RENDIMIENTO.md) para las mediciones y [Pruebas](../docs/PRUEBAS.md) para los comandos de regresión.

### Dependencias y riesgos pendientes

Los hallazgos de la fase 6 se abordaron en la fase 7. Consulta los [resultados de seguridad y dependencias](../docs/SEGURIDAD.md).

## Instalación y verificación final

- Se usa el lockfile reconstruido con `npm ci`. El navegador sirve jsPDF, SheetJS y Chart.js desde `vendor/`, con sus licencias.
- La plantilla [PERMISOS_CONTASYS_APP.sql](../database/PERMISOS_CONTASYS_APP.sql) se aplica a una cuenta nueva, con los nombres del esquema, usuario y host reemplazados. El script de Cypress la prueba en MySQL de forma aislada. La cuenta operativa se reserva para migraciones, respaldo y mantenimiento.
- `npm.cmd run test:e2e` desde la raíz ejecuta Cypress con Chrome y una API real. `npm.cmd run test:e2e:open` abre el modo visual. Para las pruebas de Node, ejecuta `npm.cmd test` desde `backend/`. Con `CONTASYS_PRUEBA_MYSQL=1` se incluyen las integraciones que crean esquemas ficticios.
- El JWT con `localStorage` sigue vigente. El [diseño de cookies y CSRF](../docs/SEGURIDAD.md) requiere aprobación y coordinación del despliegue.
- La fase 7 no añade una migración de esquema. Aplica los pasos pendientes en orden y consulta la [guía de actualización y respaldo](../docs/INSTALACION_Y_RESPALDO.md).

## Comprobar la API

Abre en el navegador: `http://localhost:3000/api/salud` — debe mostrar `{"estado":"ok","mensaje":"CONTASYS API funcionando"}`.

Para probar el resto de endpoints necesitas una herramienta como [Postman](https://www.postman.com/downloads/) o `curl`, porque requieren enviar datos (JSON) y, la mayoría, un token de autenticación.

## Endpoints disponibles

| Método | Ruta | Rol requerido | Descripción |
|---|---|---|---|
| GET | `/api/salud` | Público | Verifica que la API responde |
| POST | `/api/auth/registro` | Público | Crea una cuenta Contador o Emprendedor |
| POST | `/api/auth/login` | Público | Inicia sesión y devuelve un token JWT (máx. 5 intentos fallidos por 15 min) |
| GET | `/api/auth/sesion` | Autenticado | Consulta el rol y la identidad vigentes |
| POST | `/api/auth/logout` | Autenticado | Revoca la sesión del token utilizado |
| GET | `/api/categorias?tipo=ingreso\|egreso` | Autenticado | Lista categorías activas |
| GET | `/api/categorias/todas` | Administrador | Lista todas las categorías |
| POST | `/api/categorias` | Administrador | Crea una categoría |
| PUT | `/api/categorias/:id/estado` | Administrador | Activa o desactiva una categoría |
| GET | `/api/metodos-pago` | Autenticado | Lista métodos de pago activos |
| GET | `/api/metodos-pago/todos` | Administrador | Lista todos los métodos de pago |
| POST | `/api/metodos-pago` | Administrador | Crea un método de pago |
| PUT | `/api/metodos-pago/:id/estado` | Administrador | Activa o desactiva un método de pago |
| GET/POST/PUT/DELETE | `/api/ingresos` y `/api/ingresos/:id` | Autenticado | CRUD de ingresos propios (filtros: `fechaDesde`, `fechaHasta`, `idCategoria`) |
| GET/POST/PUT/DELETE | `/api/egresos` y `/api/egresos/:id` | Autenticado | CRUD de egresos propios |
| GET/POST/PUT/DELETE | `/api/presupuestos` y `/api/presupuestos/:id` | Autenticado | CRUD de presupuestos, con `ejecutado`, `porcentaje` y `excedido` calculados |
| GET | `/api/reportes?desde=YYYY-MM-DD&hasta=YYYY-MM-DD` | Autenticado | Totales, gastos por categoría y detalle del periodo |
| GET | `/api/dashboard` | Autenticado | KPIs y últimos movimientos |
| GET | `/api/analisis` | Autenticado | Tendencia mensual, tasa de ahorro y top de categorías |
| GET | `/api/notificaciones` | Autenticado | Lista las notificaciones |
| GET | `/api/notificaciones/pendientes` | Autenticado | Cuenta las notificaciones pendientes de la propia cuenta |
| PUT | `/api/notificaciones/:id/vista` | Autenticado | Marca una notificación como vista |
| PUT | `/api/notificaciones/:id/archivar` | Autenticado | Archiva una notificación |
| GET | `/api/historial` | Autenticado | Actividad reciente del usuario |
| GET / PUT | `/api/suscripcion` | Autenticado | Consulta o cambia el plan (Free / Premium simulado) |
| GET / POST | `/api/facturas` | Autenticado | Lista y filtra facturas propias, guarda borradores o emite directamente |
| GET / PUT | `/api/facturas/:id` | Titular | Consulta una factura o edita un borrador |
| GET | `/api/facturas/:id/ingresos-elegibles` | Titular | Lista los ingresos propios que cumplen las reglas de conciliación |
| PUT | `/api/facturas/:id/estado` | Titular | Emite, anula o registra el pago según la transición permitida |
| POST | `/api/facturas/:id/correcciones-pago` | Titular | Corrige el pago identificado por `idPago` con motivo y confirmación |
| PUT | `/api/vinculos/:id/facturas` | Emprendedor titular | Autoriza o revoca la lectura de facturas del vínculo |
| GET | `/api/usuarios` | Administrador | Lista los usuarios |
| PUT | `/api/usuarios/:id/estado` | Administrador | Activa o desactiva un usuario |
| GET | `/api/mensajes/contactos` | Autenticado | Contactos del chat con mensajes no leídos |
| GET | `/api/mensajes/:idOtroUsuario` | Autenticado | Conversación con otro usuario |
| POST | `/api/mensajes` | Autenticado | Envía un mensaje |

Para las rutas que requieren token, agrega el encabezado:
```
Authorization: Bearer <el token que te devolvió el login>
```

## Seguridad implementada

- Contraseñas con `bcrypt` (nunca se guardan en texto plano ni en hash reversible).
- Autenticación con JWT: cada petición protegida verifica la firma, la sesión y el estado vigente de la cuenta.
- Los movimientos y presupuestos se filtran por la cuenta autenticada. La consulta delegada usa la cuenta del cliente cuando existe un vínculo aceptado y se presenta como solo lectura.

# Pruebas

## Cómo ejecutar las suites

Usa la carpeta raíz de CONTASYS, Node.js, Chrome y MySQL. Configura las variables de conexión `DB_HOST`, `DB_PORT`, `DB_USER` y `DB_PASSWORD` en la terminal para apuntar a una instancia MySQL aislada. Las pruebas crean esquemas con nombres aleatorios. Confirman el esquema activo antes de cargar el SQL y comprueban también el esquema de la conexión que usa la API de prueba. Los datos de cada prueba son ficticios.

```powershell
$env:CONTASYS_PRUEBA_MYSQL = '1'
$env:CONTASYS_NAVEGADOR = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
npm.cmd --prefix backend test -- --test-concurrency=1
npm.cmd run test:e2e
npm.cmd audit
npm.cmd --prefix backend audit
```

Cypress levanta la API real en un puerto local temporal, utiliza una cuenta SQL restringida al esquema de prueba y la bloquea al terminar. El comando imprime la ruta local de sus artefactos.

### Verificación del 25 de noviembre de 2026

- Backend, MySQL y Chromium aprobaron 21 de 21 pruebas.
- Cypress aprobó 10 de 10 casos al repetir la suite. En la primera corrida aprobó 9 de 10 porque el archivo Excel apareció después de agotarse la espera de la prueba. El archivo de esa corrida también se verificó independientemente y contenía las 124 filas esperadas.
- Las auditorías npm de la raíz y del backend reportaron cero vulnerabilidades en los manifiestos examinados.
- La [revisión de rendimiento](RENDIMIENTO.md) recoge las latencias y los planes SQL.
- Reportes y MySQL coincidieron en $52.602,66 COP por cada tipo de movimiento confirmado.

### Resultados de la validación previa

- **Backend, MySQL y Chromium:** 21 pruebas aprobadas durante la validación. El plazo global de la suite MySQL se amplió para dar margen a sus migraciones y diez casos secuenciales. Se conservó la comprobación del tiempo de espera del pool.
- **Cypress con la API real:** 10 de 10 casos aprobados durante la validación. La prueba responsive abre el menú en celular y consulta en Reportes el periodo de los movimientos ficticios. La prueba de emisión espera las respuestas HTTP de creación y recarga del historial antes de comprobar el contenido y el PDF.
- **Correcciones recientes:** Chromium con la API real verificó eliminación de movimientos permitidos, protección del ingreso asociado a un pago, edición y emisión de borrador, descarga PDF, solicitudes y revocación, separación de permisos delegados, contraste del botón Aceptar, confirmación roja al desactivar y revocación de la sesión. Se comprobó en Mi cuenta la ausencia de los textos retirados.
- **Responsive y marca:** 15 páginas en cinco resoluciones y dos alturas útiles adicionales. Las 105 vistas con API simulada cargaron el favicon oficial y no registraron desbordamiento horizontal de la página ni errores JavaScript. Inicio de sesión y Error de acceso ajustaron su altura al navegador. El botón de Error de acceso recibió foco visible con Tab y volvió al inicio con Enter. En Chat se comprobó que el compositor permanece visible tras abrir una conversación en escritorio con 640 px de altura útil. Se generaron capturas de la marca en las interfaces y en PDF con datos ficticios.
- **Seguridad:** cero vulnerabilidades reportadas por `npm audit` en raíz y backend. Las tres bibliotecas de navegador en `vendor/` quedan fuera de esos manifiestos y sus huellas SHA-256 coincidieron con el inventario registrado. La regresión cubrió sesiones, revocación, roles, accesos delegados, privacidad de notificaciones y restricciones de planes.

## Resultados históricos de la fase 7

| Ejecución | Aprobadas | Fallidas | Omitidas |
|---|---:|---:|---:|
| Node en instalación limpia con HTTP y MySQL aislado | 19 | 0 | 2 pruebas Chromium ejecutadas aparte |
| Chromium aparte | 3 | 0 | 0 |
| Cypress inicial, cuatro specs | 7 | 2 | 0 |
| Cypress final, cuatro specs | 10 | 0 | 0 |

La prueba de datos del PDF con doble aparece en ambas suites. En las exportaciones se comprobaron acentos, centavos, el PDF de factura de una página, el reporte de cuatro páginas y las 124 filas al reabrir el Excel.

## Matriz histórica de verificación de la fase 7

**Cypress real** usa Chrome 159, la interfaz, la API Express y MySQL con la cuenta temporal de privilegios mínimos. **Integración** usa HTTP real y MySQL en los esquemas de regresión. **Doble** se refiere a pruebas de cliente con API, DOM, PDF o Excel simulados. Los estados se refieren a los casos enumerados.

| Módulo | Casos aprobados | Tipo | Alcance pendiente |
|---|---|---|---|
| Login y registro | Entrada válida para los tres roles, contraseña incorrecta, duplicados, registro de Contador, rechazo de Administrador, URL protegida y cierre. Registro de Emprendedor, intentos fallidos, expiración, revocación y desactivación. | Cypress e integración | Recorrido visual de todos los campos inválidos. |
| Dashboard | Saldos confirmados, pendientes por separado, aislamiento, actualización ante altas, ediciones, bajas y correcciones. Entrada y navegación. | Integración y Cypress | Comparación visual en navegadores adicionales. |
| Ingresos | Páginas de 50, totales del filtro, decimales, categorías y medios, límites, histórico inactivo, importes confirmados y protección de ingresos facturados. | Cypress e integración | Revisión visual de todos los filtros combinados. |
| Egresos | Alta por formulario, ejecución del presupuesto, validaciones, propiedad y estados. | Cypress e integración | Revisión visual exhaustiva de edición y filtros. |
| Presupuestos | Creación por formulario, ejecución al 92 %, cupo simultáneo, cambio de plan, umbrales, consulta de solo lectura y recuperación tras un inicio anterior a hoy. | Cypress e integración | Prueba de semanas de funcionamiento continuo del evaluador. |
| Reportes | Rango, paginación de 100 más 24, gráfica real, PDF de cuatro páginas, Excel reabierto con 124 filas y acentos, aislamiento y totales. | Cypress e integración | Renderizado manual en otros visores PDF y hojas muy superiores a la muestra. |
| Análisis | Gráfica visible, categorías, tendencias, periodos vacíos, fecha futura y ventanas de plan. | Cypress e integración | Combinaciones de accesibilidad visual. |
| Facturación | Emisión, filtro por documento, historial, PDF real con tildes y centavos, borradores, concurrencia, pago, conciliación, corrección y rollback. PDF corregido con estado Pendiente. | Cypress, integración y Chromium | Revisión comercial y fiscal externa. |
| Clientes | Solicitud, aceptación, autorización de facturas, cambio de cliente, revocación, rechazo, suspensión, ausencia de escrituras delegadas y privacidad de borradores. | Cypress, integración y doble de respuesta tardía | Secuencias visuales exhaustivas de revocación y suspensión. |
| Mensajes | Envío y recepción entre cuentas, lectura, paginación anterior, cursor incremental, bloqueo para cuenta inactiva y respuesta obsoleta descartada. | Cypress, integración y doble | Medición de memoria con chat abierto durante muchas horas. |
| Notificaciones | Solicitud visible, marcado visto, archivado, contador, privacidad y ausencia de duplicados. | Cypress e integración | Matriz visual completa de estados vacíos y sin conexión. |
| Mi cuenta | Plan Premium visible, actividad, autorizar el acceso a facturas. | Cypress e integración | Teclado y lectura exhaustiva con tecnologías asistivas. |
| Usuarios | Panel de Administrador, navegación permitida por rol, desactivación, reactivación, permisos vigentes y conservación de registros. | Cypress e integración | Revisión manual de todas las estadísticas visuales. |
| Configuración | Lista de categorías y alta de un método desde la interfaz con la cuenta limitada. Integridad del tipo de categoría e históricos. | Cypress e integración | Recorrido visual de todas las altas y cambios de estado. |
| Suscripciones | Free, Premium, renovación, vencimiento, vuelta a Free, precios preservados y simulación bloqueada en producción. | Integración y Cypress para lectura y Excel Premium | Renovación y vencimiento desde la interfaz en otra zona horaria. |

**Responsive.** Facturación se revisó a 375, 768, 1024, 1366 y 1920 px. Navegación desde dashboard hacia chat y reportes se revisó a 375 y 1024 px. Cypress verificó que los documentos no desbordaran horizontalmente y el foco por teclado programático de un campo. La prueba no equivale a una auditoría de contraste, lectores de pantalla o todos los atajos.

**Migraciones y resiliencia.** Diagnóstico de metadatos, instalación limpia, actualización de un esquema de demostración con datos, salud sin pool y tras pérdida de una conexión, espera acotada con las diez conexiones ocupadas, cierre de una solicitud HTTP en marcha y respaldo/restauración. [Procedimiento y recuentos](INSTALACION_Y_RESPALDO.md)

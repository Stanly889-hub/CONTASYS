# Matriz de verificación

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

**Migraciones y resiliencia.** Diagnóstico de metadatos, instalación limpia, actualización de un esquema de demostración con datos, salud sin pool y tras pérdida de una conexión, espera acotada con las diez conexiones ocupadas, cierre de una solicitud HTTP en marcha y respaldo/restauración. [Procedimiento y recuentos](INSTALACION_RESPALDO.md)

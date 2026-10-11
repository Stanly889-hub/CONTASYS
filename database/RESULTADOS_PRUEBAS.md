# Resultados de pruebas — Sección 2 (Modelo de datos)

> Estas pruebas se ejecutaron sobre `CONTASYS_FINAL.sql` y sobre `CONTASYS_PRODUCCION.sql`, usando el archivo `pruebas_integridad.sql`. Ambas versiones produjeron resultados idénticos, confirmando que las mismas reglas de integridad se mantienen sin cambios entre una y otra.

## 1. Carga del script principal

Se ejecutaron `CONTASYS_FINAL.sql` y `CONTASYS_PRODUCCION.sql` de inicio a fin sobre un motor MySQL 8 / MariaDB 10.11.

**Resultado:** ejecución exitosa en ambos casos, sin errores. Se crearon correctamente las 12 tablas, los triggers de integridad, los índices y las 8 vistas de reportes.

| Tabla | Registros en CONTASYS_FINAL | Registros en CONTASYS_PRODUCCION |
|---|---|---|
| Usuario | 4 | 0 (se completa con el registro real de usuarios) |
| Rol | 3 | 3 |
| CategoriaFinanciera | 7 | 7 |
| MetodoPago | 6 | 6 |
| Ingreso | 5 | 0 |
| Egreso | 5 | 0 |
| Presupuesto | 5 | 0 |
| Reporte | 3 | 0 |
| Mensaje | 4 | 0 |
| Notificacion | 4 | 0 |
| Suscripcion | 4 | 0 |
| HistorialActividad | 4 | 0 |

`CONTASYS_PRODUCCION.sql` solo precarga los datos de catálogo (roles, categorías, métodos de pago) que la aplicación necesita para funcionar desde el primer uso; los usuarios y movimientos los crea el cliente real a través de la aplicación.

## 2. Pruebas de integridad (`pruebas_integridad.sql`)

Se diseñaron 7 casos para verificar que las reglas de negocio implementadas mediante triggers, `CHECK` y llaves foráneas se cumplen correctamente.

| # | Caso de prueba | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|
| 1 | Insertar un Ingreso usando una categoría de tipo Egreso | Rechazado por trigger | `ERROR 1644: La categoria asignada no es de tipo Ingreso` | ✅ Exitoso |
| 2 | Insertar un Egreso usando una categoría de tipo Ingreso | Rechazado por trigger | `ERROR 1644: La categoria asignada no es de tipo Egreso` | ✅ Exitoso |
| 3 | Insertar un Mensaje donde emisor = receptor | Rechazado por trigger | `ERROR 1644: El emisor y el receptor no pueden ser el mismo usuario` | ✅ Exitoso |
| 4 | Registrar un Usuario con un correo ya existente | Rechazado por restricción UNIQUE | `ERROR 1062: Duplicate entry 'deivid@contasys.com'` | ✅ Exitoso |
| 5 | Insertar un Ingreso con monto negativo | Rechazado por restricción CHECK | `ERROR 4025: CONSTRAINT CK_Ingreso_Monto failed` | ✅ Exitoso |
| 6 | Insertar un Ingreso válido | Aceptado | Registro insertado correctamente (idIngreso 6) | ✅ Exitoso |
| 7 | Eliminar un Usuario con movimientos asociados | Sus Ingresos/Egresos se eliminan en cascada | De 2 ingresos asociados pasó a 0 tras el DELETE | ✅ Exitoso |

## 3. Vistas de reportes

Adicionalmente se verificó que las 8 vistas de `CONTASYS_FINAL.sql` / `CONTASYS_PRODUCCION.sql` devuelven datos correctos al consultarlas directamente (`vw_balance_por_usuario`, `vw_gasto_por_categoria`, `vw_presupuesto_vs_ejecucion`, entre otras), confirmando que son reutilizables para el backend que se construirá en secciones posteriores.

## 4. Evidencia visual de ejecución

Capturas de pantalla de la ejecución real de cada script:

![Ejecución de CONTASYS_FINAL.sql](../evidencias/evidencia2/ejecucion_contasys_final.png)

![Ejecución de pruebas_integridad.sql](../evidencias/evidencia2/ejecucion_pruebas_integridad.png)

![Ejecución de CONTASYS_PRODUCCION.sql](../evidencias/evidencia2/ejecucion_contasys_produccion.png)

## 5. Conclusión

El modelo de datos de CONTASYS fue validado mediante ejecución real sobre un motor MySQL 8 / MariaDB, no solo mediante revisión de código. Las pruebas confirman que:

- Las 12 tablas, los triggers de integridad y las 8 vistas de reportes se crean correctamente sin errores, tanto en la versión de desarrollo como en la versión de producción.
- Las reglas de negocio implementadas mediante triggers, restricciones `CHECK` y llaves foráneas se cumplen de forma consistente: no es posible registrar un ingreso o egreso con una categoría del tipo incorrecto, un usuario no puede enviarse un mensaje a sí mismo, los correos electrónicos son únicos, los montos negativos son rechazados, y el borrado de un usuario elimina en cascada sus movimientos asociados.
- `CONTASYS_PRODUCCION.sql` queda listo para recibir los datos reales del cliente, sin información ficticia precargada, conservando únicamente el catálogo (roles, categorías financieras y métodos de pago) necesario para que la aplicación funcione desde el primer uso.
- La evidencia visual adjunta (sección 5) respalda la ejecución documentada en las tablas anteriores.

Con base en estos resultados, el modelo de datos se considera estable y apto para continuar con la integración de la lógica de autenticación y el backend en las siguientes secciones del proyecto.
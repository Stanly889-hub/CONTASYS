# CONTASYS

Sistema de gestión contable y financiera para pequeños negocios: control de ingresos y egresos, presupuestos, reportes y usuarios con distintos roles (Administrador, Contador).

## Hoja de ruta del proyecto (7 secciones)

1. **Análisis y prototipo de interfaz** ✅ (esta entrega): pantallas base y estructura del repositorio.
2. **Modelo de datos** ✅: diagrama ER y script SQL (MySQL 8, base `contasys_actualizado`).
3. **Autenticación y control de sesión**: validaciones reales, contraseñas seguras, protección del dashboard y permisos por rol.
4. **Ingresos y egresos (CRUD)**: categorías, edición/eliminación, filtros y navegación real desde la barra lateral.
5. **Presupuestos, reportes y análisis**: alertas de presupuesto, gráficas y exportación de reportes.
6. **Backend y base de datos real**: API conectada a MySQL, reemplazo de `localStorage`.
7. **Funciones complementarias y despliegue**: notificaciones, diseño responsive, pruebas y publicación en línea.

## Seccion 1: prototipo de interfaz

Esta entrega contiene el prototipo funcional de la interfaz, con datos guardados en `localStorage` del navegador (sin backend todavía):

- `index.html` — inicio de sesión.
- `registro.html` — creación de cuenta.
- `dashboard.html` — panel con KPIs (ingresos, egresos, balance), formulario de movimientos y tabla.
- `error.html` — pantalla de error de acceso.
- `css/styles.css` — estilos de toda la aplicación.
- `js/app.js` — funciones compartidas (usuarios, movimientos, notificaciones).
- `js/login.js`, `js/registro.js`, `js/dashboard.js` — lógica propia de cada página.

## Cómo probarlo

No requiere instalación: se abre `index.html` en el navegador. Donde puede registrarse desde "Crear cuenta" y luego iniciar sesión con sus credenciales.

## Pruebas realizadas (Seccion 1)

Se ejecutaron pruebas funcionales manuales sobre registro, login, dashboard y manejo de errores. El detalle de los casos de prueba y sus resultados está documentado en el informe entregado, y las capturas de evidencia se encuentran en la carpeta `evidencias`.

## Sección 2 — Modelo de datos

El modelo de datos de CONTASYS vive en la carpeta `database/` e incluye 12 tablas (Usuario, Rol, CategoriaFinanciera, MetodoPago, Ingreso, Egreso, Presupuesto, Reporte, Mensaje, Notificacion, Suscripcion, HistorialActividad), 6 triggers de integridad y 8 vistas de reportes reutilizables.

**Archivos:**
- `CONTASYS_FINAL.sql` — esquema completo con datos de ejemplo (usuarios, ingresos, egresos, presupuestos, etc.), pensado para desarrollo y pruebas.
- `CONTASYS_PRODUCCION.sql` — mismo esquema, pero sin datos ficticios de clientes. Solo trae precargado el catálogo (roles, categorías financieras y métodos de pago) necesario para que la aplicación funcione desde el primer uso; los usuarios y movimientos los crea el cliente real.
- `pruebas_integridad.sql` — 7 casos de prueba que validan las reglas de negocio (categorías de ingreso/egreso, montos positivos, correos únicos, prevención de autoenvío de mensajes, borrado en cascada).
- `RESULTADOS_PRUEBAS.md` — documentación de las pruebas ejecutadas, con sus resultados y evidencia visual.

**Motor:** MySQL 8.0+ / MariaDB 10.5+. Base de datos: `contasys_actualizado`.

**Cómo ejecutarlo:**
```bash
# Para desarrollo (con datos de ejemplo):
mysql -u root < database/CONTASYS_FINAL.sql

# Para producción (base limpia, sin datos ficticios):
mysql -u root < database/CONTASYS_PRODUCCION.sql

# Para correr las pruebas de integridad (sobre cualquiera de las dos anteriores):
mysql -u root --force < database/pruebas_integridad.sql
```

## Pruebas realizadas (Sección 2)

Se validó la ejecución real de los tres archivos en MySQL Workbench:

- **`CONTASYS_FINAL.sql`** — crea las 12 tablas, los triggers y las 8 vistas, y carga los datos de ejemplo (7 categorías, 6 métodos de pago, 5 ingresos, 5 egresos, entre otros).
- **`CONTASYS_PRODUCCION.sql`** — crea la misma estructura, pero queda en 0 usuarios, ingresos y egresos: solo conserva el catálogo base (7 categorías, 6 métodos de pago, 3 roles).
- **`pruebas_integridad.sql`** — ejecuta los 7 casos de prueba de integridad. La captura evidencia el rechazo esperado de la Prueba 1 (`MySQL Error 1644: La categoria asignada no es de tipo Ingreso`), confirmando que el trigger de validación de categorías funciona correctamente.

![Ejecución de CONTASYS_FINAL.sql](evidencias/evidencia2/ejecucion_contasys_final.png)

![Ejecución de CONTASYS_PRODUCCION.sql](evidencias/evidencia2/ejecucion_contasys_produccion.png)

![Ejecución de pruebas_integridad.sql](evidencias/evidencia2/ejecucion_pruebas_integridad.png)

El detalle completo de los 7 casos de prueba y sus resultados está documentado en [`database/RESULTADOS_PRUEBAS.md`](database/RESULTADOS_PRUEBAS.md).

# CONTASYS

Sistema de gestión contable y financiera para pequeños negocios: control de ingresos y egresos, presupuestos, reportes y usuarios con distintos roles (Administrador, Contador).

## Estado actual — Seccion 1: prototipo de interfaz

Esta entrega contiene el prototipo funcional de la interfaz, con datos guardados en `localStorage` del navegador (sin backend todavía):

- `index.html` — inicio de sesión.
- `registro.html` — creación de cuenta.
- `dashboard.html` — panel con KPIs (ingresos, egresos, balance), formulario de movimientos y tabla.
- `error.html` — pantalla de error de acceso.
- `css/styles.css` — estilos de toda la aplicación.
- `js/app.js` — funciones compartidas (usuarios, movimientos, notificaciones).
- `js/login.js`, `js/registro.js`, `js/dashboard.js` — lógica propia de cada página.

## Cómo probarlo

No requiere instalación: abre `index.html` en el navegador. Puedes registrarte desde "Crear cuenta" y luego iniciar sesión con esas credenciales.

## Hoja de ruta del proyecto (7 secciones)

1. **Análisis y prototipo de interfaz** ✅ (esta entrega): pantallas base y estructura del repositorio.
2. **Modelo de datos**: diagrama ER y script SQL (MySQL 8, base `contasys_seccion2`).
3. **Autenticación y control de sesión**: validaciones reales, contraseñas seguras, protección del dashboard y permisos por rol.
4. **Ingresos y egresos (CRUD)**: categorías, edición/eliminación, filtros y navegación real desde la barra lateral.
5. **Presupuestos, reportes y análisis**: alertas de presupuesto, gráficas y exportación de reportes.
6. **Backend y base de datos real**: API conectada a MySQL, reemplazo de `localStorage`.
7. **Funciones complementarias y despliegue**: notificaciones, diseño responsive, pruebas y publicación en línea.

## Pruebas realizadas (Seccion 1)

Se ejecutaron pruebas funcionales manuales sobre registro, login, dashboard y manejo de errores. El detalle de los casos de prueba y sus resultados está documentado en el informe entregado, y las capturas de evidencia se encuentran en la carpeta `evidencias`.


## Base de datos (Seccion 2)

El diagrama ER y el script SQL de la Evidencia 2 se incluirán en la carpeta `database/` cuando se integre esa entrega a este repositorio.


# CONTASYS

Sistema de gestión contable y financiera para pequeños negocios: control de ingresos y egresos, presupuestos, reportes y usuarios con distintos roles (Administrador, Contador, Emprendedor).

## Hoja de ruta del proyecto 

1. **Análisis y prototipo de interfaz** ✅ (esta entrega): pantallas base y estructura del repositorio.
2. **Modelo de datos** ✅: diagrama ER y script SQL (MySQL 8, base `contasys_actualizado`).
3. **Autenticación y control de sesión** ✅: validaciones reales, contraseñas con hash, protección del dashboard y permisos por rol.
4. **Ingresos y egresos (CRUD)** ✅: categorías, edición/eliminación, filtros y navegación real desde la barra lateral.
5. **Presupuestos, reportes y análisis** ✅: alertas de presupuesto, gráficas y exportación de reportes.
6. **Backend y base de datos real** ✅: API conectada a MySQL, reemplazo de `localStorage`.
7. **Funciones complementarias** ✅: notificaciones, diseño responsive, pruebas y documentación.
8. **Panel de administración, facturación y análisis separado** ✅: gestión de usuarios y catálogos (solo Administrador), generación de facturas en PDF, y separación de "Análisis financiero" como módulo propio con tendencias históricas.
9. **Chat entre usuarios y planes Free/Premium** ✅: mensajería interna entre usuarios del sistema y aclaración del modelo freemium (Free gratuito para todos, Premium de pago simulado).

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

La instalación completa tiene 18 tablas, 9 triggers y 8 vistas. El esquema seleccionado en MySQL Workbench debe coincidir con `DB_NAME` para la instalación que se está configurando.

- **Instalación nueva.** En un esquema vacío, ejecuta `database/CONTASYS_PRODUCCION.sql` y las migraciones en el orden indicado en la guía del backend.
- **Actualización.** Aplica las migraciones que falten en el esquema existente. Después ejecuta el diagnóstico de integridad en modo de lectura.
- **Pruebas.** La suite crea su propio esquema. Para una demostración manual, `database/pruebas/DATOS_DEMO.sql` es una carga opcional para un esquema de pruebas recién instalado. `database/RESULTADOS_PRUEBAS.md` conserva la evidencia histórica.

Consulta las instrucciones para Workbench y Visual Studio Code en [la guía del backend](backend/README.md).

## Revisión final

- Usa Node.js 22 y ejecuta `npm ci` en la raíz y en `backend/`. Sirve el frontend con su carpeta `vendor/`.
- Ejecuta `npm run test:e2e` para Cypress sin ventana o `npm run test:e2e:open` para modo visual. El comando inicia el frontend y la API con un esquema ficticio y una cuenta temporal limitada. Requiere Chrome y un operador de pruebas que pueda crear ambos.
- Consulta el [informe de la fase 7](evidencias/fase7/INFORME.md), la [guía de actualización y respaldo](evidencias/fase7/INSTALACION_RESPALDO.md) y la [revisión de seguridad](evidencias/fase7/SEGURIDAD.md).

## Sección 3 — Autenticación y control de sesión

Se implementó autenticación robusta sobre el prototipo de interfaz:

- **Contraseñas con hash (SHA-256)** mediante la Web Crypto API del navegador, en lugar de texto plano.
- **Validaciones** en registro (campos obligatorios, contraseña mínima de 6 caracteres, confirmación de contraseña) y en login (campos obligatorios).
- **Control de intentos fallidos**: tras 3 intentos de login incorrectos, el usuario es redirigido a `error.html`.
- **Protección del dashboard**: `dashboard.html` verifica que exista una sesión activa; si no, redirige automáticamente a `index.html`.
- **Cierre de sesión** desde el dashboard, que elimina la sesión activa.
- **Permisos por rol**: los usuarios con rol distinto de "Administrador" no ven las opciones "Usuarios" ni "Configuración" en el menú lateral.

**Archivos nuevos/modificados:** `js/auth.js` (nuevo), `js/login.js`, `js/registro.js`, `js/app.js`, `js/dashboard.js`, `dashboard.html`, `css/styles.css`.

El detalle completo de las pruebas ejecutadas está documentado en el informe entregado, y las capturas de evidencia se encuentran en `evidencias/evidencia3/`.

## Sección 4 — Módulo de ingresos y egresos (CRUD)

Se implementó el CRUD completo de movimientos financieros:

- **Categorías financieras y métodos de pago**: cada movimiento se clasifica por categoría (filtrada según sea ingreso o egreso) y método de pago.
- **Editar y eliminar movimientos**, además de crear, desde una página dedicada (`movimientos.html`).
- **Filtros por fecha y categoría**, con total calculado sobre los resultados filtrados.
- **Formato de pesos colombianos** en todos los montos mostrados (KPIs, tablas, totales).
- **Barra lateral funcional**: "Ingresos" y "Egresos" navegan a `movimientos.html` con su tipo correspondiente; el resto de los módulos aún no construidos navegan a una página "menu" indicando en qué sección estarán disponibles, en lugar de no hacer nada.

**Archivos nuevos:** `movimientos.html`, `js/movimientos.js`, `proximamente.html`.
**Archivos modificados:** `js/app.js`, `js/dashboard.js`, `dashboard.html`, `css/styles.css`.

El detalle completo de las pruebas ejecutadas está documentado en el informe entregado, y las capturas de evidencia se encuentran en `evidencias/evidencia4/`.

## Sección 5 — Presupuestos, reportes y análisis

Se implementó el módulo de presupuestos y el de reportes/análisis financiero:

- **Presupuestos por categoría**, con cálculo automático de lo ejecutado (a partir de los movimientos reales) y alerta cuando se supera el monto presupuestado.
- **Reportes por periodo**: selección de rango de fechas, con resumen de ingresos, egresos y balance.
- **Gráficas**: Ingresos vs Egresos (barras) y Gastos por categoría (dona), generadas con Chart.js.
- **Exportación a PDF y Excel** del reporte generado (resumen, gráficas y detalle de movimientos).

**Librerías externas usadas (vía CDN):** Chart.js (gráficas), jsPDF (exportación a PDF), SheetJS/xlsx (exportación a Excel).

**Archivos nuevos:** `presupuestos.html`, `js/presupuestos.js`, `reportes.html`, `js/reportes.js`.
**Archivos modificados:** `js/app.js`, `dashboard.html`, `movimientos.html`, `proximamente.html`, `css/styles.css`.

El detalle completo de las pruebas ejecutadas está documentado en el informe entregado, y las capturas de evidencia se encuentran en `evidencias/evidencia5/`.

## Sección 6 — Backend y base de datos real

Se construyó una API REST con Node.js, Express y MySQL, reemplazando por completo el uso de `localStorage` en el front-end:

- **Autenticación con JWT**: el login emite un token que se envía en cada petición protegida (`Authorization: Bearer`). Las contraseñas se cifran con `bcrypt` en el servidor.
- **Endpoints por módulo**: autenticación, categorías, métodos de pago, ingresos, egresos, presupuestos, reportes y dashboard — cada uno conectado directamente a las tablas de `contasys_actualizado` (ver Sección 2).
- **Separación por usuario**: cada usuario solo puede ver y modificar sus propios movimientos y presupuestos; esto se controla desde el servidor, tomando el `idUsuario` del token, nunca de lo que envíe el cliente.
- **El front-end consume la API** mediante `fetch` (archivo `js/api.js`), en vez de leer y escribir directamente en `localStorage`.

**Stack del backend:** Node.js, Express, MySQL (vía `mysql2`), `bcryptjs`, `jsonwebtoken`, `cors`, `dotenv`.

**Carpeta nueva:** `backend/` (proyecto Node.js independiente, con su propio `package.json`).
**Archivos modificados en el front-end:** `js/api.js` (nuevo), `js/auth.js`, `js/app.js`, `js/login.js`, `js/registro.js`, `js/dashboard.js`, `js/movimientos.js`, `js/presupuestos.js`, `js/reportes.js`, `index.html`, `registro.html`.

**Cómo ejecutar el proyecto completo:**
1. Backend: dentro de `backend/`, `npm install`, configurar `.env`, `npm run dev`.
2. Front-end: abrir con Live Server.
3. Ambos deben estar corriendo al mismo tiempo.

El detalle completo de las pruebas ejecutadas está documentado en el informe entregado, y las capturas de evidencia se encuentran en `evidencias/evidencia6/`.

## Sección 7 — Funciones complementarias y diseño responsive

Se completaron algunas funciones del proyecto:

- **Suscripciones**: cada usuario nuevo recibe automáticamente un plan "Free" al registrarse, con posibilidad de cambiar a "Premium" desde "Mi cuenta" (simulado, sin pasarela de pago real).
- **Notificaciones automáticas**: cuando un presupuesto es excedido, el sistema genera una notificación persistente (no solo una alerta momentánea), visible en la página "Notificaciones", sin duplicarse en consultas repetidas.
- **Historial de actividad**: el backend registra automáticamente acciones clave (inicio de sesión, creación/edición/eliminación de movimientos, creación de presupuestos), visibles en "Mi cuenta".
- **Diseño responsive**: el menú lateral, las tarjetas de KPIs, los formularios y las tablas se adaptan a pantallas pequeñas.
**Archivos nuevos:** `notificaciones.html`, `js/notificaciones.js`, `cuenta.html`, `js/cuenta.js`, además de nuevos controladores y rutas en el backend (`notificacionesController`, `historialController`, `suscripcionController`).
**Archivos modificados:** `authController.js`, `movimientosController.js`, `presupuestosController.js`, `app.js` (backend); sidebar de todas las páginas, `css/styles.css` (frontend).

El detalle completo de las pruebas ejecutadas está documentado en el informe entregado, y las capturas de evidencia se encuentran en `evidencias/evidencia7/`.

## Sección 8 — Panel de administración, facturación y análisis financiero separado

Se genero una nueva sección complementaria debido a que contasys es un proyecto más amplio de lo esperado en donde está completa los módulos que antes estaban como "Próximamente" en el menú, y separa el "Análisis financiero" de los "Reportes" como una vista independiente.

- **Gestión de usuarios** (`usuarios.html`, solo rol Administrador): listado de todos los usuarios del sistema, con la posibilidad de activar o desactivar su acceso. Un usuario desactivado no puede volver a iniciar sesión. Un administrador no puede desactivar su propia cuenta.
- **Configuración del sistema** (`configuracion.html`, solo rol Administrador): administración de las categorías financieras y los métodos de pago — creación de nuevas y activación/desactivación de las existentes, sin necesidad de modificar la base de datos manualmente.
- **Facturación** (`facturacion.html`): generación de facturas en PDF (cliente, concepto, valor, fecha), disponible para cualquier usuario autenticado. No persiste en la base de datos, ya que "Factura" no forma parte del modelo de datos definido en la Sección 2; queda como posible extensión futura.
- **Análisis financiero** (`analisis.html`): separado de "Reportes" como módulo propio. Mientras Reportes muestra un periodo específico elegido por el usuario, Análisis financiero muestra la vista histórica completa: tendencia mensual de ingresos vs. egresos (gráfica de línea), tasa de ahorro acumulada, y las 5 categorías de mayor gasto histórico.
- **Control de acceso por rol reforzado**: todos los endpoints nuevos usan el middleware `requiereRol("Administrador")` del backend (creado en la Sección 6, usado por primera vez aquí), de modo que la restricción no depende solo de ocultar botones en la interfaz, sino que el servidor rechaza la petición aunque alguien intente acceder directamente a la API.

**Archivos nuevos (backend):** `usuariosController.js`, `analisisController.js`, sus rutas correspondientes, y las funciones de creación/activación agregadas a `categoriasController.js` y `metodosPagoController.js`.
**Archivos nuevos (frontend):** `usuarios.html`, `configuracion.html`, `facturacion.html`, `analisis.html`, y sus respectivos `.js`.
**Archivos modificados:** sidebar de todas las páginas, `app.js` (backend).

El detalle completo de las pruebas ejecutadas está documentado en el informe entregado, y las capturas de evidencia se encuentran en `evidencias/evidencia8/`.

## Sección 9 — Chat entre usuarios y modelo de planes

- **Chat interno** (`mensajes.html`): los usuarios activos pueden escribirse entre sí desde la página. Incluye lista de contactos, contador de mensajes no leídos, marcado automático como leído al abrir la conversación y actualización cada 5 segundos. Usa la tabla `Mensaje` definida en la Sección 2, incluido su trigger que impide enviarse mensajes a uno mismo.
- **Modelo freemium y premium** (`cuenta.html`): el plan **Free** es gratuito y se asigna a todos los usuarios al registrarse. El plan **Premium** es de pago ($19.900 COP/mes) y exige una confirmación explícita antes de contratarse. El cobro es simulado.

**Archivos nuevos:** `mensajesController.js`, `mensajesRoutes.js` (backend); `mensajes.html`, `js/mensajes.js` (frontend).
**Archivos modificados:** `app.js` (backend), `cuenta.html`, `js/cuenta.js`, sidebar de todas las páginas, `css/styles.css`.

Las capturas de evidencia se encuentran en `evidencias/evidencia9/`.

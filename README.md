# CONTASYS

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="css/marca/contasys.png">
  <img src="css/marca/contasys-claro.png" alt="CONTASYS" width="210">
</picture>

## Descripción del proyecto

CONTASYS v1.1.0 es un sistema de gestión contable y financiera para emprendedores y microempresas. Ayuda a registrar operaciones y consultar la situación financiera del negocio por periodo.

## Funcionalidades principales

- Registro y consulta de ingresos y egresos, control de presupuestos y alertas.
- Dashboard, análisis financiero, reportes y exportaciones PDF y Excel según el plan.
- Facturas internas, borradores, pagos y conciliación con ingresos.
- Acceso delegado a clientes, chat, notificaciones y administración de catálogos.

## Roles de usuario

| Rol | Acceso |
| --- | --- |
| Emprendedor | Gestiona su información financiera, su plan y los permisos de sus contadores. |
| Contador | Consulta los datos de clientes vinculados según el permiso concedido. El acceso a facturas requiere autorización separada. |
| Administrador | Gestiona roles, estado de cuentas, categorías financieras y métodos de pago. |

## Planes Free y Premium

- **Free.** Incluye el registro y la consulta de movimientos y hasta tres presupuestos activos vigentes.
- **Premium.** Elimina ese límite, añade alertas preventivas y habilita las exportaciones de reportes en PDF y Excel.

## Tecnologías utilizadas

HTML, CSS y JavaScript en el navegador. Node.js y Express en la API REST. MySQL para la persistencia. Chart.js, jsPDF y SheetJS se distribuyen en [vendor](vendor/README.md).

## Estructura del proyecto

| Ruta | Contenido |
| --- | --- |
| Raíz, `css/` y `js/` | Páginas, estilos y lógica de interfaz. |
| [backend](backend/README.md) | API, configuración, scripts operativos y pruebas de Node.js. |
| [database](database/) | Esquema base, migraciones, diagnósticos, permisos y datos de demostración. |
| [cypress](cypress/) | Pruebas de extremo a extremo. |
| [docs](docs/) | Guías técnicas y resultados verificados. |

## Requisitos de instalación

Node.js 22, npm y MySQL con InnoDB, CTE y restricciones `CHECK`. La verificación usó MySQL 26.7.0. Para las pruebas de navegador, instala Chrome.

## Instalación y ejecución

1. Ejecuta `npm ci` en la raíz y `npm --prefix backend ci`.
2. Usa [backend/.env.example](backend/.env.example) como plantilla para `backend/.env`. Configura la conexión y un secreto de sesión privado.
3. Instala el esquema y aplica las migraciones en el orden de la [guía del backend](backend/README.md#base-de-datos). Para una instalación existente, consulta primero [Instalación y respaldo](docs/INSTALACION_Y_RESPALDO.md).
4. Desde la raíz ejecuta `npm --prefix backend start` y comprueba `GET /api/salud`. En PowerShell puedes usar `npm.cmd`.
5. Sirve los archivos del frontend por HTTP, por ejemplo con Live Server. Abre `index.html` y ajusta el origen permitido en el backend si usas un puerto distinto al configurado.

## Pruebas del software

La validación de v1.1.0 aprobó 21 de 21 pruebas de backend, MySQL aislado y Chromium. Cypress obtuvo 10 de 10 al repetir la suite tras una espera agotada al comprobar Excel en la primera ejecución. En los listados de 10.000 registros las medianas paginadas fueron 25,48 ms para Ingresos y 20,40 ms para Egresos. Consulta [Pruebas](docs/PRUEBAS.md) para ejecutar las suites con datos ficticios.

## Documentación técnica

- [Arquitectura](docs/ARQUITECTURA.md)
- [Instalación y respaldo](docs/INSTALACION_Y_RESPALDO.md)
- [Pruebas](docs/PRUEBAS.md)
- [Seguridad](docs/SEGURIDAD.md)
- [Rendimiento](docs/RENDIMIENTO.md)

## Versiones del proyecto

La versión actual es **CONTASYS v1.1.0**. El [CHANGELOG](CHANGELOG.md) conserva el historial de v1.0.0 y v1.1.0.

## Limitaciones actuales

La facturación es interna o demostrativa. Los pagos de suscripción se simulan en los entornos habilitados para pruebas. Siguen pendientes la edición de perfil y contraseña desde Mi cuenta, la búsqueda y paginación de usuarios y la edición de catálogos. La cobertura de accesibilidad es básica y la revisión de navegador se concentró en Chromium.

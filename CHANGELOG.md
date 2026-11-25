# Historial de cambios de CONTASYS

## CONTASYS v1.1.0

Versión candidata para publicación académica.

### Identidad e interfaces

- Componentes compartidos, iconografía SVG y logotipo oficial con variantes de contraste y favicon.
- Inicio de sesión con composición de dos paneles y control de visibilidad de contraseña. Error de acceso con retorno al inicio y foco de teclado visible.
- Dashboard, Ingresos, Egresos, Presupuestos, Facturación, Reportes y Análisis con jerarquía visual, filtros, tablas, gráficas y estados de carga, vacío y error.
- Menú y barra superior consistentes. Mejoras en Clientes, Chat, Notificaciones, Mi cuenta, Usuarios y Configuración.
- Adaptación a escritorio, tabletas y celulares. Inicio de sesión y Error de acceso ajustados a la altura útil. Desplazamiento del Chat concentrado en contactos y conversaciones cuando el espacio lo permite.

### Facturación y reportes

- Resumen de importes en el formulario de factura y exportación PDF con el logotipo oficial. Se conserva la distinción entre borrador, emisión y pago.
- Reportes PDF con identidad corporativa, periodo, importes en COP y encabezados de tabla para documentos de varias páginas.
- Excel con encabezados, anchos de columna y formatos ajustados. Los importes exportados permanecen numéricos y la descarga conserva las restricciones del plan.

### Correcciones verificadas

- Se comprobó la eliminación de movimientos permitidos y la protección de ingresos asociados a pagos de facturas.
- Se validaron la aceptación, el rechazo y la revocación de solicitudes de contadores, con permisos financieros y de facturación separados.
- Se mejoró la lectura del botón Aceptar, el contraste de la confirmación de desactivación y la presentación de Mi cuenta. La desactivación sigue revocando sesiones.
- Ingresos y Egresos cargan en paralelo los catálogos independientes. El menú compartido usa una codificación más ligera del logotipo con los mismos píxeles y respaldo PNG.

### Pruebas previas y limitaciones

- En la verificación del 25 de noviembre de 2026, backend, MySQL y Chromium aprobaron 21 de 21 pruebas. Cypress aprobó 10 de 10 en la repetición, tras un tiempo de espera agotado al comprobar la descarga de Excel en la primera corrida.
- La matriz de 105 vistas comprobó 15 páginas en cinco resoluciones y dos alturas útiles adicionales. Sin desbordamiento horizontal general ni errores JavaScript en la matriz simulada.
- Con 10.000 registros ficticios por listado, las medianas paginadas fueron 25,48 ms en Ingresos y 20,40 ms en Egresos. Reportes y MySQL coincidieron en $52.602,66 COP por cada tipo de movimiento confirmado. Las auditorías npm de raíz y backend reportaron cero vulnerabilidades.
- Facturación de uso interno o demostrativo. La simulación de suscripciones se reserva para entornos de prueba. Continúan pendientes la edición de perfil y contraseña desde Mi cuenta, la búsqueda y paginación de usuarios y la edición de catálogos.
- La sesión sigue usando el almacenamiento local del navegador y la revocación en el servidor. La transición a cookies seguras está documentada como trabajo pendiente en la [guía del backend](backend/README.md).
- La revisión de accesibilidad cubrió aspectos básicos de teclado, foco, contraste y movimiento reducido. La primera navegación del rediseño transfiere más recursos que v1.0.0. MySQL puede elegir planes distintos con la misma consulta. Los resultados y condiciones de rendimiento están en el [README](README.md).

## v1.0.0

Versión de referencia para seguridad, finanzas, facturación, rendimiento y pruebas. Consulta el [informe técnico de fase 7](evidencias/fase7/INFORME.md).

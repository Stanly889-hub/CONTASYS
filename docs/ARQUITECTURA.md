# Arquitectura

CONTASYS separa las páginas estáticas, la API REST y la persistencia en MySQL.

1. Las páginas HTML usan estilos de `css/`, módulos de `js/` y bibliotecas locales en [vendor](../vendor/README.md). El cliente consume la API desde [js/api.js](../js/api.js).
2. La API arranca en [backend/server.js](../backend/server.js) y monta rutas y middleware en [backend/src/app.js](../backend/src/app.js). Las rutas llaman a controladores y utilidades de negocio.
3. Los controladores consultan MySQL mediante el pool. Las operaciones financieras relacionadas, como registrar un pago y generar su ingreso asociado, se coordinan dentro de transacciones.
4. El esquema base, las migraciones y los diagnósticos se encuentran en [database](../database/). El [orden de instalación](../backend/README.md#base-de-datos) cubre instalaciones nuevas y actualizaciones.

La API comprueba la sesión revocable, el rol vigente, el plan y los permisos delegados. El permiso de consulta financiera de un cliente y el permiso de consulta de sus facturas se conceden por separado. Consulta [Seguridad](SEGURIDAD.md) para el modelo de sesión y [la guía del backend](../backend/README.md) para contratos HTTP y detalles financieros.

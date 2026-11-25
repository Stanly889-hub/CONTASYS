# Seguridad y dependencias · Fase 7

## Dependencias verificadas

Se reconstruyó el lockfile del backend a partir del inventario instalado y se resolvieron solo cambios dirigidos. Se ejecutó `npm ci` en dos directorios limpios. La raíz instaló 171 paquetes y el backend 119. En la instalación limpia se reutilizó el binario Cypress 16.3.0 de la caché, que luego pasó su verificación de arranque. Las auditorías JSON de esas instalaciones están en [seguridad](seguridad/).

| Dependencia | Resultado |
|---|---|
| Express | Conserva 5.3.0 en el lockfile. |
| body-parser | 2.4.0 con una resolución explícita compatible con el rango de Express. Corrige GHSA-27r3-jxmh-p828. |
| nodemon y minimatch | nodemon 3.1.11 usa minimatch 3.1.5. El audit final del backend no repitió los avisos previos. |
| jsPDF | 4.2.1, compilación UMD local y licencia MIT. |
| SheetJS Community Edition | 0.20.3, compilación local de la distribución oficial y licencia Apache-2.0. |
| Chart.js | 4.6.2, compilación UMD local y licencia MIT. |

Las auditorías de npm informaron cero avisos de los lockfiles. Las bibliotecas copiadas en `vendor/` se revisaron aparte. El resultado refleja los avisos publicados y consultados en el momento de la prueba.

- [Corrección de body-parser](https://github.com/expressjs/body-parser/releases/tag/v2.4.0)
- [Aviso corregido en jsPDF 4.2.1](https://github.com/parallax/jsPDF/security/advisories/GHSA-wfv2-pwc8-crg5)
- [Distribución de SheetJS para navegador](https://docs.sheetjs.com/docs/getting-started/installation/standalone/)
- [Avisos de Chart.js](https://github.com/chartjs/Chart.js/security/advisories)

## Autenticación, acceso y navegador

La API conserva el JWT de la sesión en `localStorage`, expira y revoca sesiones en MySQL y consulta el rol y estado vigente. Los tests ejercitan revocación, desactivación, rol actualizado, plan y acceso delegado. Los datos visibles de los módulos revisados se insertan con `textContent`; los usos de `innerHTML` encontrados vacían elementos o insertan texto HTML fijo. Los filtros financieros y de sesión usan parámetros SQL y el identificador de usuario autenticado o delegado autorizado. Se añadieron encabezados contra MIME sniffing y frames en la API, y se desactivó el identificador de Express.

La verificación local consultó el secreto sin mostrarlo. Está configurado, mide al menos 32 bytes y difiere del valor de `.env.example` en HEAD. Eso no certifica su procedencia ni descarta una divulgación histórica. Si fue compartido, procede programar su rotación con autorización. `.env`, variantes locales, respaldos y descargas de pruebas están excluidos de Git. Los extractos y capturas de esta fase usan datos ficticios.

## Diseño propuesto de cookies y CSRF

El despliegue admite frontend y API en orígenes separados. Pasar a cookies cambia el origen público, el proxy, el desarrollo local y la forma de iniciar sesión de los clientes API. El cambio queda pendiente de aprobación.

1. Servir frontend y API bajo un origen HTTPS en producción y mantener un perfil de desarrollo del mismo origen. La API emitiría una cookie de sesión con prefijo `__Host-`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/` y sin `Domain`. El perfil local tendría su propia configuración y no relajaría la de producción.
2. Conservar el JWT y su ID de sesión en MySQL. Revocar al cerrar sesión o desactivar la cuenta. Entregar un token CSRF separado y ligado a la sesión, y exigirlo en un encabezado para escrituras. Validar explícitamente el origen en escrituras y autenticación. La cookie se limpiaría al cerrar sesión o expirar.
3. Coordinar el cambio de frontend, API y clientes. Tras verificar la cookie, eliminar el token antiguo del navegador y exigir un nuevo inicio de sesión en el punto de corte. No rotar el secreto como efecto colateral.
4. Ejecutar primero CSP en modo de informe en el servidor del frontend. Las páginas aún usan controladores HTML `onclick`. Una CSP sin scripts inline exige migrarlos a listeners y probar todos los módulos antes de activar el bloqueo. HSTS debe configurarse en el proxy HTTPS real.

# Informe final · CONTASYS

## Estado de las siete fases

1. **Seguridad y autenticación.** Registro público limitado por rol, primer Administrador aprovisionado de forma controlada, sesiones verificables y revocables, permisos vigentes y auditoría.
2. **Base de datos.** Esquema común, migraciones aditivas, integridad referencial, recuperación de suscripciones faltantes, retención de sesiones y protección frente al borrado en cascada.
3. **Finanzas.** Cálculo exacto en centavos, confirmados separados de pendientes y anulados, validaciones comunes y balances reconciliados.
4. **Clientes y alertas.** Vínculos con autorización y revocación, cupos concurrentes, alertas transaccionales deduplicadas y privacidad.
5. **Facturación.** Facturas internas persistentes, consecutivos, PDF, ingreso único por pago, conciliación, corrección interna, historial y autorización delegada de solo lectura.
6. **Rendimiento.** Índices medidos, cursores, chat incremental, consultas financieras agrupadas, diagnóstico y cierre ordenado.
7. **Verificación final.** Instalación limpia, dependencias actualizadas, biblioteca local, permisos mínimos, pruebas Cypress reales, restauración, reconexión, recuperación de alertas y ajuste responsive a 768 px.

## Resultados automatizados reales

| Ejecución | Aprobadas | Fallidas | Omitidas |
|---|---:|---:|---:|
| Node en instalación limpia con HTTP y MySQL aislado | 19 | 0 | 2 pruebas Chromium ejecutadas aparte |
| Chromium aparte | 3 | 0 | 0 |
| Cypress inicial, cuatro specs | 7 | 2 | 0 |
| Cypress final, cuatro specs | 10 | 0 | 0 |

La prueba de datos del PDF con doble se repite entre suites y no representa un caso único adicional. La ejecución final de Cypress usó `contasys_prueba_e2e_681e7cc75a` y la plantilla de permisos. MySQL rechazó `DELETE` sobre Usuario y `ALTER`. `SHOW GRANTS` confirmó que carecía de privilegios globales, `DROP` y `GRANT OPTION`. No se intentó borrar un esquema. Al finalizar, la cuenta temporal quedó bloqueada.

La ejecución inicial detectó desbordamiento de facturación a 768 px y un selector inexistente en el caso de presupuesto. Se ajustó el dimensionamiento del menú lateral al aplicar el breakpoint y se corrigió el selector del test. Las capturas de ambos fallos y la ejecución final se conservaron.

- [Matriz por módulos](MATRIZ.md)
- [Ejecución real de Cypress con rutas locales anonimizadas](cypress/ejecucion-final-publica.txt)
- [Captura de factura emitida](cypress/factura-emitida-real.png)
- [PDF de factura](exportaciones/FAC-00000001.pdf)
- [PDF de reporte](exportaciones/reporte_contasys_2026-01-15_a_2026-01-15.pdf)
- [Apertura y renderizado de los PDF con PDFium](exportaciones/verificacion-pdfium.txt)
- [Excel Premium de reporte](exportaciones/reporte_contasys_2026-01-15_a_2026-01-15.xlsx)

Los PDF se descargaron en Chrome. Se comprobaron texto, acentos y totales de centavos de la factura, contenido del reporte, cabecera, tabla de referencias y cierre. La factura tiene una página y el reporte tiene cuatro. El Excel se reabrió con SheetJS y se comprobó que contiene las 124 filas, aunque en la pantalla se mostraban 100 por página. La prueba de Chromium independiente volvió a generar el PDF de una factura recuperada después de una corrección y confirmó el estado Pendiente con jsPDF 4.2.1.

## Rendimiento final

Mismos esquemas y filtros de la fase 6. Mediana de siete solicitudes autenticadas por endpoint, sin compresión y en loopback. Los JSON de [rendimiento](rendimiento/) guardan los tres tamaños y los planes. Las comparaciones exactas de los indicadores financieros pasaron.

| Endpoint, muestra de 10.000 | Fase 6, ms | Fase 7, ms | Bytes fase 7 |
|---|---:|---:|---:|
| Ingresos paginados | 11,48 | 11,38 | 11.970 |
| Facturas paginadas | 23,13 | 23,21 | 9.368 |
| Chat inicial | 6,00 | 5,93 | 7.930 |
| Sondeo sin mensajes nuevos | 4,41 | 4,41 | 31 |
| Presupuestos | 12,62 | 12,28 | 36.533 |
| Dashboard | 27,20 | 28,62 | 1.142 |
| Análisis | 46,31 | 47,14 | 1.421 |
| Reporte completo | 187,81 | 178,92 | 3.378.812 |

El lote de ocho lecturas de ingresos a 10.000 pasó de 77,30 a 91,71 ms en una muestra, con RSS de Node de 114,4 a 113,3 MiB. Es variación observada en una medición local, no un resultado garantizado. El reporte amplio mantiene su tamaño para exportar. En integración se ocuparon las diez conexiones, venció la adquisición y se recuperó la API al liberar el pool. Se interrumpió una conexión arrendada del esquema ficticio y salud volvió a responder 200. El cierre ordenado drenó una solicitud HTTP antes de cerrar el pool de prueba.

## Seguridad, instalación y pendientes

- **Medio, pendiente de aprobación.** Cambiar de JWT en localStorage a cookie HttpOnly del mismo origen con CSRF y CSP estricta. Implica coordinar origen HTTPS, proxy, cliente y cierre de sesiones anteriores. [Diseño y auditoría](SEGURIDAD.md)
- **Medio para producción, pendiente de operación.** Configurar la cuenta específica en el entorno real, respaldo privado, proxy HTTPS y verificación en staging. La prueba aislada valida el conjunto de permisos. No se aplicaron grants al esquema real. [Guía de actualización](INSTALACION_RESPALDO.md)
- **Limitación comercial.** Facturas internas o de demostración. La activación de Premium es simulada fuera de producción. La emisión fiscal y cobro real siguen fuera del alcance.
- **Cobertura restante.** Accesibilidad formal, navegadores distintos a Chromium, pruebas de larga duración y recorridos visuales exhaustivos de cada combinación de errores, estados e interfaces. [Matriz](MATRIZ.md)

**Recomendación académica.** Apta para entrega y demostración en el entorno verificado siguiendo la guía. La evidencia cubre los flujos centrales y sus regresiones. Cualquier despliegue comercial requiere validar el entorno real y resolver antes las decisiones pendientes de seguridad y operación.

# Rendimiento de CONTASYS · Fase 6

Cada volumen contiene 100, 1.000 o 10.000 registros ficticios por tabla principal de movimientos, facturas, mensajes, notificaciones y actividad. Los usuarios medidos son titulares de aproximadamente seis de cada siete movimientos y facturas. Los presupuestos suman 6, 30 y 100 por esquema.

Se comparó el mismo esquema aislado antes y después. Cada ruta tuvo una llamada de calentamiento y siete mediciones HTTP autenticadas en loopback sin compresión. Los JSON conservan la mediana, el máximo observado, bytes, consultas del pool, resultados financieros y planes. Se verificó la igualdad exacta de dashboard, reportes, análisis, presupuestos y facturas.

## Medianas HTTP en milisegundos

| Ruta | 100 antes → después | 1.000 antes → después | 10.000 antes → después | Bytes a 10.000 antes → después | Consultas a 10.000 antes → después |
|---|---:|---:|---:|---:|---:|
| Ingresos | 8,15 → 7,38 | 17,39 → 7,67 | 79,68 → 11,48 | 2.026.382 → 11.970 | 2 → 3 |
| Egresos | 6,60 → 6,47 | 12,10 → 6,59 | 74,22 → 10,03 | 2.063.523 → 12.189 | 2 → 3 |
| Facturas | 6,12 → 5,78 | 10,58 → 6,95 | 62,58 → 23,13 | 1.582.897 → 9.368 | 2 → 3 |
| Chat inicial | 6,16 → 6,19 | 10,71 → 6,32 | 61,61 → 6,00 | 1.578.895 → 7.930 | 3 → 3 |
| Sondeo del chat sin mensajes nuevos | 5,52 → 4,26 | 10,82 → 4,26 | 93,69 → 4,41 | 1.578.895 → 31 | 3 → 2 |
| Contactos | 4,81 → 4,76 | 5,15 → 4,58 | 12,11 → 4,70 | 87 → 87 | 2 → 2 |
| Notificaciones | 4,64 → 5,17 | 8,33 → 5,39 | 39,25 → 5,31 | 616.484 → 5.463 | 2 → 2 |
| Pendientes | 4,44 → 4,18 | 5,87 → 4,35 | 18,95 → 5,04 | 19 → 19 | 2 → 2 |
| Historial | 4,97 → 4,67 | 4,81 → 4,74 | 4,99 → 4,87 | 14.402 → 7.263 | 2 → 2 |
| Presupuestos | 5,52 → 5,42 | 34,98 → 6,59 | 1.051,31 → 12,62 | 36.533 → 36.533 | 3 → 3 |
| Dashboard | 5,97 → 5,11 | 28,15 → 7,27 | 1.333,44 → 27,20 | 1.142 → 1.142 | 3 → 3 |
| Análisis | 6,97 → 6,16 | 15,38 → 11,28 | 244,46 → 46,31 | 1.421 → 1.421 | 4 → 4 |
| Reporte completo | 7,59 → 6,61 | 44,16 → 26,58 | 1.467,38 → 187,81 | 3.378.812 → 3.378.812 | 2 → 2 |

Ingresos, egresos y facturas ejecutan una agregación adicional para conservar indicadores de todo el filtro. La comparación usa movimientos paginados sin la opción adicional de catálogos históricos. Reportes sigue devolviendo todos los registros para exportar y dibuja de a 100 filas.

| Volumen | Lote de 8 ingresos concurrentes, ms | CPU de usuario de Node durante el lote, ms | RSS de Node al terminar, MiB |
|---:|---:|---:|---:|
| 100 | 73,20 → 72,65 | 47 → 62 | 78,3 → 77,7 |
| 1.000 | 97,18 → 76,77 | 78 → 31 | 97,0 → 84,3 |
| 10.000 | 1.048,90 → 77,30 | 312 → 31 | 156,0 → 114,4 |

La última tabla corresponde a un lote por volumen. La RSS incluye el proceso de pruebas, diagnósticos y API. Ocho peticiones no caracterizan la saturación del pool de diez conexiones. El hardware, el calentamiento y la distribución ficticia limitan la extrapolación a producción. Quedan fuera de estas cifras el consumo de MySQL y Chromium, los cuadros por segundo y la memoria del navegador a largo plazo.

## Planes SQL e índices

- El reporte recorría los movimientos 42 veces por rama al comenzar con el producto de catálogos. Ahora parte de los movimientos y consulta las dimensiones por clave primaria. El nodo raíz instrumentado en EXPLAIN ANALYZE pasó de 5.191 ms a 103 ms.
- Dashboard materializaba 17.142 filas para escoger cinco recientes. Con el límite dentro de cada rama el orden final recibe diez filas. El nodo de recientes pasó de 1.406 ms a 0,167 ms. El total confirmado sigue leyendo las filas correspondientes al usuario.
- Presupuestos agregaba por cada presupuesto. La nueva consulta agrega por rangos distintos. La muestra grande tenía cien presupuestos y dos rangos distintos. El nodo principal pasó de 1.064 ms a 6,17 ms.
- `IDX_Ingreso_Usuario_Fecha` y `IDX_Egreso_Usuario_Fecha` soportan el orden de listados y recientes por propietario y fecha. InnoDB incorpora la clave primaria como desempate.
- `IDX_Ingreso_Ejecucion` y `IDX_Egreso_Ejecucion` cubren usuario, categoría, estado, fecha y monto. Aparecen en los planes de agregación y ejecución de presupuestos.
- `IDX_Mensaje_Conversacion` sirve los dos sentidos del chat y `IDX_Mensaje_Pendientes` soporta el agrupado por emisor para el destinatario.
- `IDX_Notificacion_Usuario_Fecha`, `IDX_Notificacion_Pendientes` e `IDX_Historial_Usuario_Fecha` sirven los cursores y el conteo de pendientes.
- Facturas, detalles, pagos y presupuestos reutilizan índices existentes. La búsqueda parcial de facturas sigue examinando candidatos del titular. La migración conserva los índices anteriores. El costo de escrituras sostenidas y la eliminación de índices heredados requieren mediciones separadas.

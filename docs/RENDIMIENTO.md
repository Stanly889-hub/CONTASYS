# Rendimiento

## Verificación de CONTASYS v1.1.0

El 25 de noviembre de 2026, con 10.000 registros ficticios por listado, las medianas paginadas fueron 25,48 ms para Ingresos y 20,40 ms para Egresos. MySQL leyó 60 movimientos para obtener las 51 filas que usa el paginador. Los totales confirmados coincidieron con MySQL en $52.602,66 COP por tipo de movimiento. La línea base sin paginación obtuvo 139,24 ms y 102,90 ms, respectivamente. La diferencia incluye el efecto de paginar.

### Mediciones anteriores de la candidata

El comparador de rendimiento genera conjuntos ficticios de 100, 1.000 y 10.000 registros por listado y compara las respuestas antes y después del índice de rendimiento. Para cada periodo suma en MySQL únicamente los movimientos confirmados del titular y contrasta los importes exactos con Reportes. En los tres volúmenes coincidieron los ingresos y egresos por separado. Los importes fueron 521,73 COP, 5.258,22 COP y 52.602,66 COP por cada tipo de movimiento. Las demás cifras financieras comparadas se mantuvieron iguales entre las dos ejecuciones.

La medición de API registra la mediana de siete solicitudes tras un calentamiento, en loopback y con 10.000 registros ficticios por listado. Las fases 6 y 7 son referencias históricas. En los ensayos lentos MySQL ordenó 8.571 filas en Ingresos para devolver 51. En dos repeticiones con el mismo conjunto nuevo, el motor usó un recorrido inverso por el índice de fecha en ambos listados y leyó 60 filas para obtener 51. La API usa la fila adicional para saber si hay una página siguiente y envía 50. El código del controlador, el SQL y los índices son idénticos a v1.0.0. La diferencia observada en esos ensayos proviene del plan de MySQL. La información histórica disponible permite identificar el plan lento y su trabajo adicional, aunque carece de una captura de las estadísticas internas con las que el optimizador lo eligió.

| API con 10.000 registros | Fase 6, ms | Fase 7, ms | Ensayos lentos v1.1.0, ms | Dos repeticiones finales, ms |
| --- | ---: | ---: | ---: | ---: |
| Ingresos | 11,48 | 11,38 | 142,43–172,01 | 11,01 y 16,41 |
| Egresos | 10,03 | 12,32 | 132,13–143,77 | 11,37 y 13,34 |

Los listados conservaron tres consultas SQL por petición en la medición de API, el cursor por fecha e identificador, los filtros y los totales verificables. La carga de categorías y métodos de pago comienza en paralelo en el navegador. El menú compartido ofrece WebP sin pérdida con respaldo PNG. Ambas variantes WebP tienen las mismas dimensiones y píxeles RGBA que los PNG de origen.

El plan lento inició por los catálogos: estimó una fila para su combinación y procesó 42. Después buscó movimientos por usuario y categoría para cada combinación, comprobó el método de pago y ordenó los resultados. El plan rápido inicia por los movimientos ordenados. Recorre el índice de fecha y busca cada categoría y método por su clave primaria hasta completar la página. Esa diferencia explica el salto de latencia sin cambiar el tamaño de la página ni la lógica financiera.

En una comparación separada de Chrome 159 a 1366 × 768, ambas versiones recibieron la misma respuesta simulada y renderizaron dos páginas de 50 movimientos. Cada navegación y su paginación hicieron seis solicitudes a la API, incluidas dos del listado. Las primeras mediciones tomaron entre 22 y 29 ms de la respuesta al pintado de la primera tabla. En la segunda página, la última ronda midió de 21 a 22 ms en v1.0.0 y de 28 a 38 ms en v1.1.0. La última ronda también registró mayor latencia de la respuesta simulada y mayor variación de tiempos de carga. Las mediciones de memoria JavaScript son instantáneas de una sesión de navegador reutilizada y no miden el consumo total.

Con la caché deshabilitada, los recursos del frontend de los listados pasaron de 356.307 bytes en la medición inicial de v1.1.0 a 249.194 bytes después de la optimización, aproximadamente un 30 % menos. La referencia v1.0.0 usa 36.274 bytes y tenía una presentación más ligera. El costo adicional de la primera carga permanece documentado.

Se registraron además 16 cargas en Chrome 159 a 1366 × 768 con API simulada local y gráficas con datos ficticios. Tras la primera visita de cada página, la mediana del evento `load` fue 85,1 ms en Inicio de sesión, 79,7 ms en Dashboard, 313,7 ms en Reportes y 98,4 ms en Análisis. La evidencia registra también recursos, solicitudes de API y memoria JavaScript observada en la misma sesión. El evento `load` mide la carga del documento y sus recursos, mientras que el ensayo espera aparte a que Chart.js haya creado las gráficas. Los recursos en caché y la reutilización del navegador limitan la comparación de transferencia y memoria. Las fases anteriores no aportan una referencia equivalente de navegador.

## Comparación histórica entre las fases 6 y 7

Se usaron los mismos esquemas y filtros con siete solicitudes autenticadas por endpoint, en loopback y sin compresión.

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

## Referencia histórica de la fase 6

Cada volumen contiene 100, 1.000 o 10.000 registros ficticios por tabla principal de movimientos, facturas, mensajes, notificaciones y actividad. Los usuarios medidos son titulares de aproximadamente seis de cada siete movimientos y facturas. Los presupuestos suman 6, 30 y 100 por esquema.

Se comparó el mismo esquema aislado antes y después. Cada ruta tuvo una llamada de calentamiento y siete mediciones HTTP autenticadas en loopback sin compresión. Los JSON conservan la mediana, el máximo observado, bytes, consultas del pool, resultados financieros y planes. Se verificó la igualdad exacta de dashboard, reportes, análisis, presupuestos y facturas.

### Medianas HTTP en milisegundos

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

### Planes SQL e índices

- El reporte recorría los movimientos 42 veces por rama al comenzar con el producto de catálogos. Ahora parte de los movimientos y consulta las dimensiones por clave primaria. El nodo raíz instrumentado en EXPLAIN ANALYZE pasó de 5.191 ms a 103 ms.
- Dashboard materializaba 17.142 filas para escoger cinco recientes. Con el límite dentro de cada rama el orden final recibe diez filas. El nodo de recientes pasó de 1.406 ms a 0,167 ms. El total confirmado sigue leyendo las filas correspondientes al usuario.
- Presupuestos agregaba por cada presupuesto. La nueva consulta agrega por rangos distintos. La muestra grande tenía cien presupuestos y dos rangos distintos. El nodo principal pasó de 1.064 ms a 6,17 ms.
- `IDX_Ingreso_Usuario_Fecha` y `IDX_Egreso_Usuario_Fecha` soportan el orden de listados y recientes por propietario y fecha. InnoDB incorpora la clave primaria como desempate.
- `IDX_Ingreso_Ejecucion` y `IDX_Egreso_Ejecucion` cubren usuario, categoría, estado, fecha y monto. Aparecen en los planes de agregación y ejecución de presupuestos.
- `IDX_Mensaje_Conversacion` sirve los dos sentidos del chat y `IDX_Mensaje_Pendientes` soporta el agrupado por emisor para el destinatario.
- `IDX_Notificacion_Usuario_Fecha`, `IDX_Notificacion_Pendientes` e `IDX_Historial_Usuario_Fecha` sirven los cursores y el conteo de pendientes.
- Facturas, detalles, pagos y presupuestos reutilizan índices existentes. La búsqueda parcial de facturas sigue examinando candidatos del titular. La migración conserva los índices anteriores. El costo de escrituras sostenidas y la eliminación de índices heredados requieren mediciones separadas.

## Reproducción

Configura MySQL aislado como se indica en [Pruebas](PRUEBAS.md). Desde la raíz ejecuta `node backend/scripts/medir-rendimiento.js antes 10000 linea-base.json` y luego `node backend/scripts/medir-rendimiento.js despues 10000 linea-base.json`. Usa archivos separados para 100 o 1.000 registros. Conserva los resultados fuera del repositorio.

# CONTASYS - Backend (Sección 6)

API REST con Node.js + Express + MySQL, con autenticación por JWT. Reemplaza el uso de `localStorage` en el front-end: cada módulo (usuarios, ingresos, egresos, presupuestos, reportes) ahora se guarda en la base de datos real.

## Requisitos

- Node.js 18 o superior instalado (`node --version` para comprobar).
- MySQL 8 / MariaDB corriendo (el mismo que usaste para probar los scripts de la Sección 2).

## Instalación

1. Instala las dependencias:
   ```bash
   npm install
   ```

2. Copia el archivo de variables de entorno de ejemplo:
   ```bash
   cp .env.example .env
   ```

3. Abre `.env` y ajusta los valores a tu entorno local (usuario y contraseña de tu MySQL, nombre de la base de datos). Si tu MySQL local no tiene contraseña para `root`, deja `DB_PASSWORD=` vacío.

4. Asegúrate de haber ejecutado `database/CONTASYS_PRODUCCION.sql` (de la Sección 2) contra tu MySQL — ese script crea las tablas que esta API usa. Es idempotente, así que puedes volver a ejecutarlo sin problema.

5. Inicia el servidor:
   ```bash
   npm run dev
   ```
   (usa `npm start` si no quieres que se reinicie solo al guardar cambios)

6. Deberías ver en la consola: `CONTASYS API escuchando en http://localhost:3000`

## Probar que funciona

Abre en el navegador: `http://localhost:3000/api/salud` — debe mostrar `{"estado":"ok","mensaje":"CONTASYS API funcionando"}`.

Para probar el resto de endpoints necesitas una herramienta como [Postman](https://www.postman.com/downloads/) o `curl`, porque requieren enviar datos (JSON) y, la mayoría, un token de autenticación.

## Endpoints disponibles

| Método | Ruta | Requiere token | Descripción |
|---|---|---|---|
| POST | `/api/auth/registro` | No | Crea un usuario nuevo |
| POST | `/api/auth/login` | No | Inicia sesión, devuelve un token JWT |
| GET | `/api/categorias?tipo=ingreso\|egreso` | Sí | Lista categorías financieras |
| GET | `/api/metodos-pago` | Sí | Lista métodos de pago |
| GET | `/api/ingresos` | Sí | Lista los ingresos del usuario autenticado (filtros opcionales: `fechaDesde`, `fechaHasta`, `idCategoria`) |
| POST | `/api/ingresos` | Sí | Crea un ingreso |
| PUT | `/api/ingresos/:id` | Sí | Edita un ingreso |
| DELETE | `/api/ingresos/:id` | Sí | Elimina un ingreso |
| GET/POST/PUT/DELETE | `/api/egresos...` | Sí | Igual que ingresos |
| GET/POST/PUT/DELETE | `/api/presupuestos...` | Sí | CRUD de presupuestos, cada uno con `ejecutado`, `porcentaje` y `excedido` calculados |
| GET | `/api/reportes?desde=YYYY-MM-DD&hasta=YYYY-MM-DD` | Sí | Totales, gastos por categoría y detalle del periodo |
| GET | `/api/dashboard` | Sí | KPIs y últimos movimientos |

Para las rutas que requieren token, agrega el encabezado:
```
Authorization: Bearer <el token que te devolvió el login>
```

## Seguridad implementada

- Contraseñas con `bcrypt` (nunca se guardan en texto plano ni en hash reversible).
- Autenticación con JWT: cada endpoint protegido verifica el token antes de responder.
- Cada usuario solo puede ver, editar o eliminar sus propios movimientos y presupuestos (se filtra por `idUsuario` tomado del token, nunca del `body` de la petición).

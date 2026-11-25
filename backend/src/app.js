const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const catalogosRoutes = require("./routes/catalogosRoutes");
const ingresosRoutes = require("./routes/ingresosRoutes");
const egresosRoutes = require("./routes/egresosRoutes");
const presupuestosRoutes = require("./routes/presupuestosRoutes");
const reportesRoutes = require("./routes/reportesRoutes");
const notificacionesRoutes = require("./routes/notificacionesRoutes");
const historialRoutes = require("./routes/historialRoutes");
const suscripcionRoutes = require("./routes/suscripcionRoutes");
const analisisRoutes = require("./routes/analisisRoutes");
const usuariosRoutes = require("./routes/usuariosRoutes");
const mensajesRoutes = require("./routes/mensajesRoutes");
const vinculosRoutes = require("./routes/vinculosRoutes");
const facturasRoutes = require("./routes/facturasRoutes");
const { requiereAutenticacion } = require("./middleware/auth");
const { aplicarClienteActivo } = require("./middleware/clienteActivo");
const { opcionesCors } = require("./config/cors");
const { salud } = require("./controllers/saludController");

const app = express();

app.disable("x-powered-by");
app.use((_req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "same-origin");
    res.set("X-Frame-Options", "DENY");
    next();
});
app.use(cors(opcionesCors()));
app.use(express.json());

app.get("/api/salud", salud);

// Modo "Contador consulta a un cliente" (?clienteId=..., solo lectura) para los módulos de datos.
app.use(
    ["/api/ingresos", "/api/egresos", "/api/presupuestos", "/api/analisis", "/api/reportes", "/api/dashboard"],
    requiereAutenticacion,
    aplicarClienteActivo
);

app.use("/api/auth", authRoutes);
app.use("/api", catalogosRoutes);
app.use("/api/ingresos", ingresosRoutes);
app.use("/api/egresos", egresosRoutes);
app.use("/api/presupuestos", presupuestosRoutes);
app.use("/api", reportesRoutes);
app.use("/api/notificaciones", notificacionesRoutes);
app.use("/api/historial", historialRoutes);
app.use("/api/suscripcion", suscripcionRoutes);
app.use("/api/analisis", analisisRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/mensajes", mensajesRoutes);
app.use("/api/vinculos", vinculosRoutes);
app.use("/api/facturas", facturasRoutes);

app.use((req, res) => {
    res.status(404).json({ error: "Ruta no encontrada" });
});
app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === "entity.parse.failed") return res.status(400).json({ error: "JSON inválido" });
    if (error.type === "entity.too.large") return res.status(413).json({ error: "La solicitud supera el tamaño permitido" });
    console.error("Error de API:", error.code || error.name);
    return res.status(500).json({ error: "No se pudo procesar la solicitud" });
});

module.exports = app;

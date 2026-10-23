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

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

app.get("/api/salud", (req, res) => {
    res.json({ estado: "ok", mensaje: "CONTASYS API funcionando" });
});

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

app.use((req, res) => {
    res.status(404).json({ error: "Ruta no encontrada" });
});

module.exports = app;

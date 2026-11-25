const express = require("express");
const router = express.Router();

const { requiereAutenticacion } = require("../middleware/auth");
const controlador = require("../controllers/notificacionesController");

router.use(requiereAutenticacion, (req, res, next) => {
    if (req.query.clienteId !== undefined) return res.status(403).json({ error: "Las notificaciones son privadas de cada cuenta" });
    next();
});
router.get("/", controlador.listar);
router.get("/pendientes", controlador.pendientes);
router.put("/:id/vista", controlador.marcarVista);
router.put("/:id/archivar", controlador.archivar);

module.exports = router;

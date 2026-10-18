const express = require("express");
const router = express.Router();

const { requiereAutenticacion } = require("../middleware/auth");
const controlador = require("../controllers/reportesController");

router.get("/reportes", requiereAutenticacion, controlador.generarReporte);
router.get("/dashboard", requiereAutenticacion, controlador.dashboard);

module.exports = router;

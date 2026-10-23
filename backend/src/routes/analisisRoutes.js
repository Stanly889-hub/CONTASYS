const express = require("express");
const router = express.Router();

const { requiereAutenticacion } = require("../middleware/auth");
const controlador = require("../controllers/analisisController");

router.get("/", requiereAutenticacion, controlador.obtenerAnalisis);

module.exports = router;

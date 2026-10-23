const express = require("express");
const router = express.Router();

const { requiereAutenticacion } = require("../middleware/auth");
const controlador = require("../controllers/historialController");

router.get("/", requiereAutenticacion, controlador.listar);

module.exports = router;

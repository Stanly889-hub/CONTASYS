const express = require("express");
const router = express.Router();

const { requiereAutenticacion } = require("../middleware/auth");
const controlador = require("../controllers/suscripcionController");

router.get("/", requiereAutenticacion, controlador.obtener);
router.put("/", requiereAutenticacion, controlador.cambiarPlan);

module.exports = router;

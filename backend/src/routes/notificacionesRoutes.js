const express = require("express");
const router = express.Router();

const { requiereAutenticacion } = require("../middleware/auth");
const controlador = require("../controllers/notificacionesController");

router.get("/", requiereAutenticacion, controlador.listar);
router.put("/:id/vista", requiereAutenticacion, controlador.marcarVista);
router.put("/:id/archivar", requiereAutenticacion, controlador.archivar);

module.exports = router;

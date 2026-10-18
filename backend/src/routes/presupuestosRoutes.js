const express = require("express");
const router = express.Router();

const { requiereAutenticacion } = require("../middleware/auth");
const controlador = require("../controllers/presupuestosController");

router.get("/", requiereAutenticacion, controlador.listar);
router.post("/", requiereAutenticacion, controlador.crear);
router.put("/:id", requiereAutenticacion, controlador.actualizar);
router.delete("/:id", requiereAutenticacion, controlador.eliminar);

module.exports = router;

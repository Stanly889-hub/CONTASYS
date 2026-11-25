const express = require("express");
const router = express.Router();
const { requiereAutenticacion } = require("../middleware/auth");
const { requiereRol } = require("../middleware/roles");
const controlador = require("../controllers/vinculosController");

router.get("/", requiereAutenticacion, controlador.listar);
router.post("/", requiereAutenticacion, requiereRol("Contador"), controlador.solicitar);
router.put("/:id/responder", requiereAutenticacion, controlador.responder);
router.put("/:id/facturas", requiereAutenticacion, controlador.autorizarFacturas);
router.delete("/:id", requiereAutenticacion, controlador.eliminar);

module.exports = router;

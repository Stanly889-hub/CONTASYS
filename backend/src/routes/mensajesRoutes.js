const express = require("express");
const router = express.Router();

const { requiereAutenticacion } = require("../middleware/auth");
const controlador = require("../controllers/mensajesController");

router.get("/contactos", requiereAutenticacion, controlador.listarContactos);
router.get("/:idOtroUsuario", requiereAutenticacion, controlador.obtenerConversacion);
router.post("/", requiereAutenticacion, controlador.enviarMensaje);

module.exports = router;

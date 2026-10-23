const express = require("express");
const router = express.Router();

const { requiereAutenticacion } = require("../middleware/auth");
const { requiereRol } = require("../middleware/roles");
const controlador = require("../controllers/usuariosController");

router.get("/", requiereAutenticacion, requiereRol("Administrador"), controlador.listar);
router.put("/:id/estado", requiereAutenticacion, requiereRol("Administrador"), controlador.cambiarEstado);

module.exports = router;

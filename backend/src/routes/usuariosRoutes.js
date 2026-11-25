const express = require("express");
const router = express.Router();

const { requiereAutenticacion } = require("../middleware/auth");
const { requiereRol } = require("../middleware/roles");
const controlador = require("../controllers/usuariosController");

router.get("/", requiereAutenticacion, requiereRol("Administrador"), controlador.listar);
router.get("/estadisticas", requiereAutenticacion, requiereRol("Administrador"), controlador.estadisticas);
router.put("/:id/rol", requiereAutenticacion, requiereRol("Administrador"), controlador.cambiarRol);
router.put("/:id/estado", requiereAutenticacion, requiereRol("Administrador"), controlador.cambiarEstado);

module.exports = router;
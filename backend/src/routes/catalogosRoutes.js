const express = require("express");
const router = express.Router();

const { requiereAutenticacion } = require("../middleware/auth");
const { requiereRol } = require("../middleware/roles");
const categoriasController = require("../controllers/categoriasController");
const metodosPagoController = require("../controllers/metodosPagoController");

router.get("/categorias", requiereAutenticacion, categoriasController.listar);
router.get("/categorias/todas", requiereAutenticacion, requiereRol("Administrador"), categoriasController.listarTodas);
router.post("/categorias", requiereAutenticacion, requiereRol("Administrador"), categoriasController.crear);
router.put("/categorias/:id/estado", requiereAutenticacion, requiereRol("Administrador"), categoriasController.cambiarEstado);

router.get("/metodos-pago", requiereAutenticacion, metodosPagoController.listar);
router.get("/metodos-pago/todos", requiereAutenticacion, requiereRol("Administrador"), metodosPagoController.listarTodos);
router.post("/metodos-pago", requiereAutenticacion, requiereRol("Administrador"), metodosPagoController.crear);
router.put("/metodos-pago/:id/estado", requiereAutenticacion, requiereRol("Administrador"), metodosPagoController.cambiarEstado);

module.exports = router;

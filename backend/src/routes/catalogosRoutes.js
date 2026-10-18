const express = require("express");
const router = express.Router();

const { requiereAutenticacion } = require("../middleware/auth");
const categoriasController = require("../controllers/categoriasController");
const metodosPagoController = require("../controllers/metodosPagoController");

router.get("/categorias", requiereAutenticacion, categoriasController.listar);
router.get("/metodos-pago", requiereAutenticacion, metodosPagoController.listar);

module.exports = router;

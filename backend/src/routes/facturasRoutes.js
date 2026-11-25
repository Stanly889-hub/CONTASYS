const router = require("express").Router();
const { requiereAutenticacion } = require("../middleware/auth");
const controlador = require("../controllers/facturasController");
const { aplicarClienteActivo } = require("../middleware/clienteActivo");

router.use(requiereAutenticacion, (req, res, next) => aplicarClienteActivo(req, res, next, true));
router.get("/", controlador.listar);
router.post("/", controlador.guardar);
router.get("/:id/ingresos-elegibles", controlador.ingresosElegibles);
router.get("/:id", controlador.obtener);
router.put("/:id", controlador.guardar);
router.put("/:id/estado", controlador.cambiarEstado);
router.post("/:id/correcciones-pago", controlador.corregirPago);

module.exports = router;

const express = require("express");
const router = express.Router();
const { registrar, iniciarSesion, cerrarSesion } = require("../controllers/authController");
const { requiereAutenticacion } = require("../middleware/auth");

router.post("/registro", registrar);
router.post("/login", iniciarSesion);
router.post("/logout", requiereAutenticacion, cerrarSesion);
router.get("/sesion", requiereAutenticacion, (req, res) => res.json(req.usuario));

module.exports = router;

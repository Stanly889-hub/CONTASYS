const express = require("express");
const router = express.Router();
const { registrar, iniciarSesion } = require("../controllers/authController");

router.post("/registro", registrar);
router.post("/login", iniciarSesion);

module.exports = router;

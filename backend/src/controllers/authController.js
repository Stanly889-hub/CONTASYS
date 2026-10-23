const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { generarToken } = require("../utils/jwt");
const { registrarActividad } = require("../utils/actividad");

async function registrar(req, res) {
    try {
        const { documento, nombre, apellido, correo, password, rol, ciudad, telefono } = req.body;

        if (!documento || !nombre || !apellido || !correo || !password || !rol) {
            return res.status(400).json({ error: "Todos los campos obligatorios deben estar completos" });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
        }

        const [rolesEncontrados] = await pool.query(
            "SELECT idRol FROM Rol WHERE nombreRol = ?",
            [rol]
        );

        if (rolesEncontrados.length === 0) {
            return res.status(400).json({ error: "El rol indicado no existe" });
        }

        const idRol = rolesEncontrados[0].idRol;

        const [existentes] = await pool.query(
            "SELECT idUsuario FROM Usuario WHERE correo = ? OR documento = ?",
            [correo, documento]
        );

        if (existentes.length > 0) {
            return res.status(409).json({ error: "Ya existe un usuario con ese correo o documento" });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const [resultado] = await pool.query(
            `INSERT INTO Usuario (documento, nombre, apellido, correo, password_hash, telefono, ciudad, fechaRegistro, idRol)
             VALUES (?, ?, ?, ?, ?, ?, ?, CURDATE(), ?)`,
            [documento, nombre, apellido, correo, passwordHash, telefono || null, ciudad || null, idRol]
        );

        // Toda cuenta nueva arranca con un plan gratuito (simulado, sin pasarela de pago real).
        await pool.query(
            `INSERT INTO Suscripcion (tipoPlan, fechaInicio, fechaFin, estado, idUsuario)
             VALUES ('Free', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 YEAR), 'Activa', ?)`,
            [resultado.insertId]
        );

        return res.status(201).json({
            mensaje: "Usuario registrado correctamente",
            idUsuario: resultado.insertId
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Error al registrar el usuario" });
    }
}

async function iniciarSesion(req, res) {
    try {
        const { correo, password } = req.body;

        if (!correo || !password) {
            return res.status(400).json({ error: "Correo y contraseña son obligatorios" });
        }

        const [usuarios] = await pool.query(
            `SELECT u.idUsuario, u.nombre, u.apellido, u.correo, u.password_hash, u.estado, r.nombreRol
             FROM Usuario u
             JOIN Rol r ON u.idRol = r.idRol
             WHERE u.correo = ?`,
            [correo]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        const usuario = usuarios[0];

        if (usuario.estado !== "Activo") {
            return res.status(403).json({ error: "El usuario está inactivo" });
        }

        const coincide = await bcrypt.compare(password, usuario.password_hash);

        if (!coincide) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        const token = generarToken({
            idUsuario: usuario.idUsuario,
            correo: usuario.correo,
            rol: usuario.nombreRol
        });

        await registrarActividad(usuario.idUsuario, "Inicio de sesión", "Autenticación", req.ip);

        return res.json({
            token,
            usuario: {
                idUsuario: usuario.idUsuario,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                correo: usuario.correo,
                rol: usuario.nombreRol
            }
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Error al iniciar sesión" });
    }
}

module.exports = { registrar, iniciarSesion };

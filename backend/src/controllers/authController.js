const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { generarToken } = require("../utils/jwt");
const { registrarActividad } = require("../utils/actividad");
const { enTransaccion } = require("../utils/transaccion");
const { minutosDeBloqueo, registrarFallo, limpiarIntentos } = require("../middleware/limitarLogin");

function contrasenaValida(password) {
    return typeof password === "string"
        && password.length >= 8
        && /[A-Za-z]/.test(password)
        && /\d/.test(password);
}

async function registrar(req, res) {
    try {
        const { documento, nombre, apellido, correo, password, rol, ciudad, telefono } = req.body;

        if (![documento, nombre, apellido, correo, password, rol].every(valor =>
            typeof valor === "string" && valor.trim())) {
            return res.status(400).json({ error: "Todos los campos obligatorios deben estar completos" });
        }

        if (!contrasenaValida(password)) {
            return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres e incluir letras y números" });
        }

        if (!["Contador", "Emprendedor"].includes(rol)) {
            return res.status(403).json({ error: "Rol no permitido en el registro público" });
        }
        const [rolesEncontrados] = await pool.execute(
            "SELECT idRol FROM Rol WHERE nombreRol = ?",
            [rol]
        );

        if (rolesEncontrados.length === 0) {
            return res.status(400).json({ error: "El rol indicado no existe" });
        }

        const idRol = rolesEncontrados[0].idRol;

        const passwordHash = await bcrypt.hash(password, 10);

        const idUsuario = await enTransaccion(async conexion => {
            const [resultado] = await conexion.execute(
                `INSERT INTO Usuario (documento, nombre, apellido, correo, password_hash, telefono, ciudad, fechaRegistro, idRol)
                 VALUES (?, ?, ?, ?, ?, ?, ?, CURDATE(), ?)`,
                [documento, nombre, apellido, correo, passwordHash, telefono || null, ciudad || null, idRol]
            );
            await conexion.execute(
                `INSERT INTO Suscripcion (tipoPlan, fechaInicio, fechaFin, estado, idUsuario)
                 VALUES ('Free', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 YEAR), 'Activa', ?)`,
                [resultado.insertId]
            );
            return resultado.insertId;
        });

        return res.status(201).json({
            mensaje: "Usuario registrado correctamente",
            idUsuario
        });

    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ error: "Ya existe un usuario con ese correo o documento" });
        }
        console.error("Error de registro:", error.code || error.name);
        return res.status(500).json({ error: "Error al registrar el usuario" });
    }
}

async function iniciarSesion(req, res) {
    try {
        const { correo, password } = req.body;

        if (typeof correo !== "string" || !correo.trim() || correo.length > 100 ||
            typeof password !== "string" || !password) {
            return res.status(400).json({ error: "Correo y contraseña son obligatorios" });
        }

        const minutos = minutosDeBloqueo(req);
        if (minutos > 0) {
            res.set("Retry-After", String(minutos * 60));
            return res.status(429).json({
                error: `Demasiados intentos fallidos. Intenta de nuevo en ${minutos} minuto(s)`
            });
        }

        const [usuarios] = await pool.execute(
            `SELECT u.idUsuario, u.nombre, u.apellido, u.correo, u.password_hash, u.estado
             FROM Usuario u
             WHERE u.correo = ?`,
            [correo]
        );

        if (usuarios.length === 0) {
            registrarFallo(req);
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        const usuario = usuarios[0];

        const coincide = await bcrypt.compare(password, usuario.password_hash);

        if (!coincide) {
            registrarFallo(req);
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        // Se revisa el estado DESPUÉS de validar la contraseña, para no revelar
        // a un desconocido que ese correo existe y está desactivado.
        if (usuario.estado !== "Activo") {
            return res.status(403).json({ error: "El usuario está inactivo" });
        }

        limpiarIntentos(req);

        const { token, idSesion, exp } = generarToken(usuario.idUsuario);
        const rolActual = await enTransaccion(async conexion => {
            const [[actual]] = await conexion.execute(
                "SELECT estado, idRol FROM Usuario WHERE idUsuario = ? FOR UPDATE",
                [usuario.idUsuario]
            );
            if (actual?.estado !== "Activo") return null;
            const [[{ nombreRol }]] = await conexion.execute("SELECT nombreRol FROM Rol WHERE idRol = ?", [actual.idRol]);
            await conexion.execute(
                "INSERT INTO Sesion (idSesion, idUsuario, expiraUnix) VALUES (?, ?, ?)",
                [idSesion, usuario.idUsuario, exp]
            );
            return nombreRol;
        });
        if (!rolActual) return res.status(403).json({ error: "El usuario está inactivo" });

        await registrarActividad(usuario.idUsuario, "Inicio de sesión", "Autenticación", req.ip);

        return res.json({
            token,
            usuario: {
                idUsuario: usuario.idUsuario,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                correo: usuario.correo,
                rol: rolActual
            }
        });

    } catch (error) {
        console.error("Error de inicio de sesión:", error.code || error.name);
        return res.status(500).json({ error: "Error al iniciar sesión" });
    }
}

async function cerrarSesion(req, res) {
    try {
        await pool.execute("UPDATE Sesion SET revocada = TRUE WHERE idSesion = ?", [req.idSesion]);
        return res.status(204).end();
    } catch (error) {
        console.error("Error al revocar la sesión:", error.code || error.name);
        return res.status(503).json({ error: "No se pudo cerrar la sesión. Intenta de nuevo." });
    }
}

module.exports = { registrar, iniciarSesion, cerrarSesion };

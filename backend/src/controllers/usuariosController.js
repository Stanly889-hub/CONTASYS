const pool = require("../config/db");
const { registrarActividad } = require("../utils/actividad");
const { enTransaccion } = require("../utils/transaccion");

async function listar(req, res) {
    try {
        const [usuarios] = await pool.query(
            `SELECT u.idUsuario, u.documento, u.nombre, u.apellido, u.correo, u.estado,
                    r.nombreRol AS rol, u.fechaRegistro
             FROM Usuario u
             JOIN Rol r ON u.idRol = r.idRol
             ORDER BY u.idUsuario`
        );
        return res.json(usuarios);
    } catch (error) {
        console.error("Error de API:", error.code || error.name);
        return res.status(500).json({ error: "Error al obtener los usuarios" });
    }
}

async function cambiarEstado(req, res) {
    try {
        const { id } = req.params;
        const { estado } = req.body;

        if (!["Activo", "Inactivo"].includes(estado)) {
            return res.status(400).json({ error: "Estado inválido" });
        }

        if (Number(id) === req.usuario.idUsuario && estado === "Inactivo") {
            return res.status(400).json({ error: "No puedes desactivar tu propia cuenta" });
        }

        const encontrado = await enTransaccion(async conexion => {
            const [[usuario]] = await conexion.execute(
                "SELECT estado FROM Usuario WHERE idUsuario = ? FOR UPDATE", [id]
            );
            if (!usuario) return false;
            if (usuario.estado === estado) return true;

            await conexion.execute("UPDATE Usuario SET estado = ? WHERE idUsuario = ?", [estado, id]);
            if (estado === "Inactivo") {
                await conexion.execute("UPDATE Sesion SET revocada = TRUE WHERE idUsuario = ?", [id]);
            }
            await conexion.execute(
                `INSERT INTO HistorialActividad (accion, modulo, ipUsuario, idUsuario)
                 SELECT CONCAT('Vínculo ', v.idVinculo, ': cuenta ', ?, ' pasó a ', ?),
                        'Clientes', ?, participantes.idUsuario
                 FROM ClienteContador v
                 JOIN Usuario participantes ON participantes.idUsuario IN (v.idContador, v.idCliente)
                 WHERE v.estado = 'Aceptado' AND (v.idContador = ? OR v.idCliente = ?)`,
                [id, estado, req.ip || null, id, id]
            );
            await registrarActividad(req.usuario.idUsuario, `Estado del usuario ${id}: ${usuario.estado} → ${estado}`, "Usuarios", req.ip, conexion);
            return true;
        });
        if (!encontrado) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        return res.json({ mensaje: `Usuario ${estado === "Activo" ? "activado" : "desactivado"} correctamente` });

    } catch (error) {
        console.error("Error de API:", error.code || error.name);
        return res.status(500).json({ error: "Error al actualizar el usuario" });
    }
}

// PUT /api/usuarios/:id/rol  { rol }   (solo Administrador)
async function cambiarRol(req, res) {
    try {
        const { id } = req.params;
        const { rol } = req.body;

        if (Number(id) === req.usuario.idUsuario) {
            return res.status(400).json({ error: "No puedes cambiar tu propio rol" });
        }

        if (!["Administrador", "Contador", "Emprendedor"].includes(rol)) {
            return res.status(400).json({ error: "Rol inválido" });
        }
        const [roles] = await pool.execute("SELECT idRol FROM Rol WHERE nombreRol = ?", [rol]);
        if (roles.length === 0) {
            return res.status(400).json({ error: "Rol inválido" });
        }

        const encontrado = await enTransaccion(async conexion => {
            const [[usuario]] = await conexion.execute(
                "SELECT idRol FROM Usuario WHERE idUsuario = ? FOR UPDATE", [id]
            );
            if (!usuario) return false;
            if (usuario.idRol === roles[0].idRol) return true;

            await conexion.execute("UPDATE Usuario SET idRol = ? WHERE idUsuario = ?", [roles[0].idRol, id]);
            await registrarActividad(req.usuario.idUsuario, `Cambio de rol del usuario ${id} a ${rol}`, "Usuarios", req.ip, conexion);
            return true;
        });
        if (!encontrado) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        return res.json({ mensaje: `Rol actualizado a ${rol}` });
    } catch (error) {
        console.error("Error de API:", error.code || error.name);
        return res.status(500).json({ error: "Error al actualizar el rol" });
    }
}

// GET /api/usuarios/estadisticas   (solo Administrador)
async function estadisticas(req, res) {
    try {
        const [porRol] = await pool.query(
            `SELECT r.nombreRol AS rol, COUNT(u.idUsuario) AS total
             FROM Rol r LEFT JOIN Usuario u ON u.idRol = r.idRol
             GROUP BY r.idRol, r.nombreRol`
        );
        const [porPlan] = await pool.query(
            `SELECT CASE WHEN s.tipoPlan = 'Premium' AND s.estado = 'Activa' AND CURDATE() BETWEEN s.fechaInicio AND s.fechaFin
                         THEN 'Premium' ELSE 'Free' END AS plan,
                    COUNT(*) AS total
             FROM Usuario u LEFT JOIN Suscripcion s ON s.idUsuario = u.idUsuario
             GROUP BY plan`
        );
        const [[{ total }]] = await pool.query("SELECT COUNT(*) AS total FROM Usuario");
        const [[{ activos }]] = await pool.query("SELECT COUNT(*) AS activos FROM Usuario WHERE estado = 'Activo'");

        const mapa = (filas, clave) => Object.fromEntries(filas.map(f => [f[clave], Number(f.total)]));

        return res.json({
            totalUsuarios: Number(total),
            usuariosActivos: Number(activos),
            porRol: mapa(porRol, "rol"),
            porPlan: { Free: 0, Premium: 0, ...mapa(porPlan, "plan") }
        });
    } catch (error) {
        console.error("Error de API:", error.code || error.name);
        return res.status(500).json({ error: "Error al obtener las estadísticas" });
    }
}

module.exports = { listar, cambiarEstado, cambiarRol, estadisticas };

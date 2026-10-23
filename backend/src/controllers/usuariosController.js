const pool = require("../config/db");

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
        console.error(error);
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

        const [resultado] = await pool.query(
            "UPDATE Usuario SET estado = ? WHERE idUsuario = ?",
            [estado, id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        return res.json({ mensaje: `Usuario ${estado === "Activo" ? "activado" : "desactivado"} correctamente` });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Error al actualizar el usuario" });
    }
}

module.exports = { listar, cambiarEstado };

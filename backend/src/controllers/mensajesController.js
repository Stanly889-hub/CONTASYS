const pool = require("../config/db");

async function listarContactos(req, res) {
    try {
        const [usuarios] = await pool.query(
            `SELECT u.idUsuario, u.nombre, u.apellido, r.nombreRol AS rol,
                    (SELECT COUNT(*) FROM Mensaje
                     WHERE idEmisor = u.idUsuario AND idReceptor = ? AND leido = FALSE) AS noLeidos
             FROM Usuario u
             JOIN Rol r ON u.idRol = r.idRol
             WHERE u.idUsuario != ? AND u.estado = 'Activo'
             ORDER BY u.nombre`,
            [req.usuario.idUsuario, req.usuario.idUsuario]
        );
        return res.json(usuarios);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Error al obtener los contactos" });
    }
}

async function obtenerConversacion(req, res) {
    try {
        const { idOtroUsuario } = req.params;
        const idUsuario = req.usuario.idUsuario;

        const [mensajes] = await pool.query(
            `SELECT idMensaje, contenido, fechaEnvio, leido, idEmisor, idReceptor
             FROM Mensaje
             WHERE (idEmisor = ? AND idReceptor = ?) OR (idEmisor = ? AND idReceptor = ?)
             ORDER BY fechaEnvio ASC, idMensaje ASC`,
            [idUsuario, idOtroUsuario, idOtroUsuario, idUsuario]
        );

        // Al abrir la conversacion, se marcan como leidos los mensajes que el otro usuario me envio.
        await pool.query(
            "UPDATE Mensaje SET leido = TRUE WHERE idEmisor = ? AND idReceptor = ? AND leido = FALSE",
            [idOtroUsuario, idUsuario]
        );

        return res.json(mensajes);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Error al obtener la conversación" });
    }
}

async function enviarMensaje(req, res) {
    try {
        const { idReceptor, contenido } = req.body;

        if (!idReceptor || !contenido || !contenido.trim()) {
            return res.status(400).json({ error: "Debes indicar el destinatario y el contenido del mensaje" });
        }

        const [resultado] = await pool.query(
            "INSERT INTO Mensaje (contenido, idEmisor, idReceptor) VALUES (?, ?, ?)",
            [contenido.trim(), req.usuario.idUsuario, idReceptor]
        );

        return res.status(201).json({ mensaje: "Mensaje enviado", id: resultado.insertId });

    } catch (error) {
        console.error(error);
        if (error.sqlState === "45000") {
            return res.status(400).json({ error: error.sqlMessage });
        }
        return res.status(500).json({ error: "Error al enviar el mensaje" });
    }
}

module.exports = { listarContactos, obtenerConversacion, enviarMensaje };

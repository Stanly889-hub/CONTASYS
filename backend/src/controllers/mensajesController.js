const pool = require("../config/db");
const { paginacion } = require("../utils/paginacion");
const { DatoFinancieroInvalido, idValido, textoValido, responderError } = require("../utils/validacionFinanciera");

async function listarContactos(req, res) {
    try {
        const [usuarios] = await pool.query(
            `SELECT u.idUsuario, u.nombre, u.apellido, r.nombreRol AS rol,
                    COALESCE(m.noLeidos, 0) AS noLeidos
             FROM Usuario u
             JOIN Rol r ON u.idRol = r.idRol
             LEFT JOIN (SELECT idEmisor, COUNT(*) AS noLeidos FROM Mensaje
                        WHERE idReceptor = ? AND leido = FALSE GROUP BY idEmisor) m ON m.idEmisor = u.idUsuario
             WHERE u.idUsuario != ? AND u.estado = 'Activo'
             ORDER BY u.nombre`,
            [req.usuario.idUsuario, req.usuario.idUsuario]
        );
        return res.json(usuarios);
    } catch (error) {
        console.error("Error de API:", error.code || error.name);
        return res.status(500).json({ error: "Error al obtener los contactos" });
    }
}

async function obtenerConversacion(req, res) {
    try {
        const idOtroUsuario = idValido(req.params.idOtroUsuario, "Contacto");
        const idUsuario = req.usuario.idUsuario;
        const { antes, despues } = req.query;
        if (antes !== undefined && despues !== undefined) throw new DatoFinancieroInvalido("Usa un solo cursor de mensajes");
        const pagina = paginacion({ limite: req.query.limite ?? (antes !== undefined || despues !== undefined ? 50 : undefined) }, { cursor: false });
        if (pagina) {
            const punto = antes ?? despues;
            const filtro = punto === undefined ? "" : `AND idMensaje ${antes !== undefined ? "<" : ">"} ?`;
            const direccion = despues !== undefined ? "ASC" : "DESC";
            const tramo = `SELECT idMensaje, contenido, fechaEnvio, leido, idEmisor, idReceptor FROM Mensaje
                           WHERE idEmisor = ? AND idReceptor = ? ${filtro} ORDER BY idMensaje ${direccion} LIMIT ?`;
            const adicionales = punto === undefined ? [] : [idValido(punto, "Cursor de mensajes")];
            const [filas] = await pool.execute(
                `(${tramo}) UNION ALL (${tramo}) ORDER BY idMensaje ${direccion} LIMIT ?`,
                [idUsuario, idOtroUsuario, ...adicionales, pagina.limite + 1,
                    idOtroUsuario, idUsuario, ...adicionales, pagina.limite + 1, pagina.limite + 1]
            );
            const registros = filas.slice(0, pagina.limite);
            const idMayor = Math.max(0, ...registros.map(m => m.idMensaje));
            if (idMayor && ((antes === undefined && despues === undefined) ||
                registros.some(m => m.idEmisor === idOtroUsuario && !m.leido))) {
                await pool.execute(
                    "UPDATE Mensaje SET leido = TRUE WHERE idEmisor = ? AND idReceptor = ? AND leido = FALSE AND idMensaje <= ?",
                    [idOtroUsuario, idUsuario, idMayor]
                );
                for (const m of registros) if (m.idEmisor === idOtroUsuario) m.leido = 1;
            }
            registros.sort((a, b) => a.fechaEnvio.localeCompare(b.fechaEnvio) || a.idMensaje - b.idMensaje);
            return res.json({ registros, hayMas: filas.length > pagina.limite });
        }

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
        return responderError(res, error, "Error al obtener la conversación");
    }
}

async function enviarMensaje(req, res) {
    try {
        const idReceptor = idValido(req.body?.idReceptor, "Destinatario");
        const contenido = textoValido(req.body?.contenido, "El mensaje", 65535, false, s => Buffer.byteLength(s));
        if (idReceptor === req.usuario.idUsuario) throw new DatoFinancieroInvalido("Selecciona otro destinatario");
        const [resultado] = await pool.execute(
            `INSERT INTO Mensaje (contenido, idEmisor, idReceptor)
             SELECT ?, ?, idUsuario FROM Usuario WHERE idUsuario = ? AND estado = 'Activo'`,
            [contenido, req.usuario.idUsuario, idReceptor]
        );
        if (!resultado.affectedRows) return res.status(409).json({ error: "El destinatario no está disponible" });

        return res.status(201).json({ mensaje: "Mensaje enviado", id: resultado.insertId });

    } catch (error) {
        return responderError(res, error, "Error al enviar el mensaje");
    }
}

module.exports = { listarContactos, obtenerConversacion, enviarMensaje };

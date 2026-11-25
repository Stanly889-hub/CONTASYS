const pool = require("../config/db");

// Permite que un CONTADOR consulte, en SOLO LECTURA, los datos financieros de un
// cliente que aceptó su solicitud. Se activa con ?clienteId=<id> en la URL.
//
// - Solo funciona con peticiones GET: cualquier otra operación con clienteId se rechaza.
// - Solo para el rol Contador y solo si existe un vínculo en estado "Aceptado".
// - Si todo es válido, req.usuario pasa a apuntar al cliente (los controladores
//   existentes filtran por req.usuario.idUsuario) y el contador queda en req.contador.
//   El middleware requiereAutenticacion (auth.js) conserva este contexto en las rutas.
async function aplicarClienteActivo(req, res, next, requiereFacturas = false) {
    const clienteId = req.query.clienteId;
    if (clienteId === undefined) return next();

    try {
        if (req.method !== "GET") {
            return res.status(403).json({ error: "Modo solo lectura: no puedes modificar los datos de un cliente" });
        }
        if (req.usuario.rol !== "Contador") {
            return res.status(403).json({ error: "No tienes permisos para ver los datos de otro usuario" });
        }

        const idCliente = Number(clienteId);
        if (!Number.isInteger(idCliente) || idCliente <= 0) {
            return res.status(400).json({ error: "Cliente inválido" });
        }

        const [vinculos] = await pool.execute(
            `SELECT v.idVinculo FROM ClienteContador v
             JOIN Usuario c ON c.idUsuario = v.idContador
             JOIN Usuario e ON e.idUsuario = v.idCliente
             JOIN Rol rc ON rc.idRol = c.idRol
             JOIN Rol re ON re.idRol = e.idRol
             WHERE v.idContador = ? AND v.idCliente = ? AND v.estado = 'Aceptado'
               AND c.estado = 'Activo' AND e.estado = 'Activo'
               AND rc.nombreRol = 'Contador' AND re.nombreRol = 'Emprendedor'
               ${requiereFacturas ? "AND v.facturasAutorizadas = TRUE" : ""}`,
            [req.usuario.idUsuario, idCliente]
        );
        if (vinculos.length === 0) {
            return res.status(403).json({ error: "No tienes acceso a los datos de este cliente" });
        }

        req.idClienteActivo = idCliente;
        req.contador = req.usuario;
        req.usuario = { ...req.usuario, idUsuario: idCliente };
        next();
    } catch (error) {
        console.error("Error de API:", error.code || error.name);
        return res.status(500).json({ error: "Error al validar el acceso al cliente" });
    }
}

module.exports = { aplicarClienteActivo };

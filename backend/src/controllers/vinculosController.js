const pool = require("../config/db");
const { LIMITES_FREE, esPremium } = require("../utils/plan");
const { registrarActividad } = require("../utils/actividad");
const { enTransaccion } = require("../utils/transaccion");

async function bloquearParticipantes(conexion, idContador, idCliente) {
    const [usuarios] = await conexion.execute(
        `SELECT u.idUsuario, u.nombre, u.apellido, u.estado,
                (SELECT nombreRol FROM Rol WHERE idRol = u.idRol) AS rol
         FROM Usuario u WHERE u.idUsuario IN (?, ?)
         ORDER BY u.idUsuario FOR UPDATE`,
        [idContador, idCliente]
    );
    const contador = usuarios.find(u => u.idUsuario === idContador);
    const cliente = usuarios.find(u => u.idUsuario === idCliente);
    if (contador?.estado !== "Activo" || contador.rol !== "Contador" ||
        cliente?.estado !== "Activo" || cliente.rol !== "Emprendedor") return null;
    return { contador, cliente };
}

async function crearNotificacion(idUsuario, mensaje) {
    try {
        await pool.query(
            "INSERT INTO Notificacion (mensaje, estado, idUsuario) VALUES (?, 'Pendiente', ?)",
            [mensaje, idUsuario]
        );
    } catch (error) {
        console.error("No se pudo crear la notificación:", error.code || error.name);
    }
}

// GET /api/vinculos?como=contador|cliente
//  - como=contador (solo rol Contador): mis clientes y el estado de cada vínculo.
//  - como=cliente (por defecto): los contadores que solicitaron o tienen acceso a mis datos.
async function listar(req, res) {
    try {
        const idUsuario = req.usuario.idUsuario;
        const comoContador = req.query.como === "contador";

        if (comoContador && req.usuario.rol !== "Contador") {
            return res.status(403).json({ error: "No tienes permisos para esta acción" });
        }

        const [filas] = comoContador
            ? await pool.query(
                `SELECT v.idVinculo, v.estado, v.fechaSolicitud, v.fechaRespuesta, v.facturasAutorizadas,
                        u.idUsuario AS idOtro, u.nombre, u.apellido, u.correo, u.estado AS estadoOtro
                 FROM ClienteContador v
                 JOIN Usuario u ON u.idUsuario = v.idCliente
                 WHERE v.idContador = ? AND v.estado <> 'Revocado'
                 ORDER BY v.fechaSolicitud DESC`,
                [idUsuario])
            : await pool.query(
                `SELECT v.idVinculo, v.estado, v.fechaSolicitud, v.fechaRespuesta, v.facturasAutorizadas,
                        u.idUsuario AS idOtro, u.nombre, u.apellido, u.correo
                 FROM ClienteContador v
                 JOIN Usuario u ON u.idUsuario = v.idContador
                 WHERE v.idCliente = ? AND v.estado <> 'Revocado'
                 ORDER BY v.fechaSolicitud DESC`,
                [idUsuario]);

        return res.json(filas);
    } catch (error) {
        console.error("Error de API:", error.code || error.name);
        return res.status(500).json({ error: "Error al obtener los vínculos" });
    }
}

// POST /api/vinculos  { correoCliente }   (solo Contador)
async function solicitar(req, res) {
    try {
        const idContador = req.usuario.idUsuario;
        const correoCliente = String(req.body.correoCliente || "").trim().toLowerCase();

        if (!correoCliente) {
            return res.status(400).json({ error: "Indica el correo del cliente" });
        }

        const [clientes] = await pool.query(
            `SELECT u.idUsuario FROM Usuario u
             JOIN Rol r ON u.idRol = r.idRol
             WHERE LOWER(u.correo) = ? AND u.estado = 'Activo' AND r.nombreRol = 'Emprendedor'`,
            [correoCliente]
        );
        if (clientes.length === 0) {
            return res.status(404).json({ error: "No existe un cliente (Emprendedor) activo con ese correo" });
        }
        const idCliente = clientes[0].idUsuario;

        const resultado = await enTransaccion(async conexion => {
            const partes = await bloquearParticipantes(conexion, idContador, idCliente);
            if (!partes) return { estado: 403, error: "Ambas cuentas deben estar activas y tener roles compatibles" };

            const [[existente]] = await conexion.execute(
                `SELECT idVinculo, estado, fechaSolicitud, fechaRespuesta
                 FROM ClienteContador WHERE idContador = ? AND idCliente = ? FOR UPDATE`,
                [idContador, idCliente]
            );
            if (existente && ["Pendiente", "Aceptado"].includes(existente.estado)) {
                return { estado: 409, error: "Ya existe una solicitud o un vínculo con este cliente" };
            }

            if (!(await esPremium(idContador, conexion))) {
                const [[{ total }]] = await conexion.execute(
                    `SELECT COUNT(*) AS total FROM ClienteContador
                     WHERE idContador = ? AND estado IN ('Pendiente','Aceptado')`,
                    [idContador]
                );
                if (total >= LIMITES_FREE.clientes) {
                    return { estado: 403, error: `El plan Free permite hasta ${LIMITES_FREE.clientes} clientes. Pasa a Premium para tener más` };
                }
            }

            let idVinculo = existente?.idVinculo;
            if (existente) {
                await registrarActividad(
                    idContador,
                    `Vínculo ${idVinculo}: ciclo previo ${existente.estado}; solicitud ${existente.fechaSolicitud}; respuesta ${existente.fechaRespuesta || "sin respuesta"}`,
                    "Clientes", req.ip, conexion
                );
                await conexion.execute(
                    "UPDATE ClienteContador SET estado = 'Pendiente', fechaSolicitud = NOW(), fechaRespuesta = NULL WHERE idVinculo = ?",
                    [idVinculo]
                );
            } else {
                const [creado] = await conexion.execute(
                    "INSERT INTO ClienteContador (idContador, idCliente) VALUES (?, ?)", [idContador, idCliente]
                );
                idVinculo = creado.insertId;
            }
            await registrarActividad(idContador, `Solicitud de acceso para el vínculo ${idVinculo}`, "Clientes", req.ip, conexion);
            return { contador: partes.contador };
        });
        if (resultado.error) return res.status(resultado.estado).json({ error: resultado.error });

        const { contador } = resultado;
        await crearNotificacion(
            idCliente,
            `${contador.nombre} ${contador.apellido} (Contador) solicita ver tus finanzas en modo solo lectura. Respóndele en Mi cuenta.`
        );
        return res.status(201).json({ mensaje: "Solicitud enviada" });
    } catch (error) {
        console.error("Error de API:", error.code || error.name);
        return res.status(500).json({ error: "Error al enviar la solicitud" });
    }
}

// PUT /api/vinculos/:id/responder  { aceptar: true|false }   (solo el cliente)
async function responder(req, res) {
    try {
        const { id } = req.params;
        const { aceptar } = req.body;

        if (typeof aceptar !== "boolean") {
            return res.status(400).json({ error: "Indica si aceptas o rechazas la solicitud" });
        }

        const [[vinculo]] = await pool.execute(
            "SELECT idVinculo, idContador, estado FROM ClienteContador WHERE idVinculo = ? AND idCliente = ?",
            [id, req.usuario.idUsuario]
        );
        if (!vinculo) {
            return res.status(404).json({ error: "Solicitud no encontrada" });
        }
        const nuevoEstado = aceptar ? "Aceptado" : "Rechazado";
        const resultado = await enTransaccion(async conexion => {
            const partes = await bloquearParticipantes(conexion, vinculo.idContador, req.usuario.idUsuario);
            if (!partes) return { estado: 403, error: "Ambas cuentas deben estar activas y tener roles compatibles" };
            const [cambio] = await conexion.execute(
                `UPDATE ClienteContador SET estado = ?, fechaRespuesta = NOW()
                 WHERE idVinculo = ? AND idCliente = ? AND estado = 'Pendiente'`,
                [nuevoEstado, id, req.usuario.idUsuario]
            );
            if (!cambio.affectedRows) return { estado: 400, error: "La solicitud ya no está pendiente" };
            await registrarActividad(req.usuario.idUsuario, `Vínculo ${id}: solicitud ${nuevoEstado.toLowerCase()}`, "Cuenta", req.ip, conexion);
            return { cliente: partes.cliente };
        });
        if (resultado.error) return res.status(resultado.estado).json({ error: resultado.error });
        const { cliente } = resultado;
        await crearNotificacion(
            vinculo.idContador,
            `${cliente.nombre} ${cliente.apellido} ${aceptar ? "aceptó" : "rechazó"} tu solicitud de acceso a sus finanzas.`
        );
        return res.json({ mensaje: aceptar ? "Solicitud aceptada" : "Solicitud rechazada" });
    } catch (error) {
        console.error("Error de API:", error.code || error.name);
        return res.status(500).json({ error: "Error al responder la solicitud" });
    }
}

// DELETE /api/vinculos/:id   (el contador o el cliente del vínculo pueden quitarlo)
async function eliminar(req, res) {
    try {
        const { id } = req.params;
        const idUsuario = req.usuario.idUsuario;

        const cambiado = await enTransaccion(async conexion => {
            // Mismo orden de bloqueo que las operaciones que modifican una cuenta.
            const [[usuario]] = await conexion.execute("SELECT estado FROM Usuario WHERE idUsuario = ? FOR UPDATE", [idUsuario]);
            if (usuario?.estado !== "Activo") return false;
            const [resultado] = await conexion.execute(
                `UPDATE ClienteContador SET estado = 'Revocado'
                 WHERE idVinculo = ? AND estado <> 'Revocado' AND (idContador = ? OR idCliente = ?)`,
                [id, idUsuario, idUsuario]
            );
            if (resultado.affectedRows === 0) return false;
            await registrarActividad(idUsuario, `Vínculo ${id} revocado`, "Clientes", req.ip, conexion);
            return true;
        });
        if (!cambiado) {
            return res.status(404).json({ error: "Vínculo no encontrado" });
        }

        return res.json({ mensaje: "Vínculo eliminado" });
    } catch (error) {
        console.error("Error de API:", error.code || error.name);
        return res.status(500).json({ error: "Error al eliminar el vínculo" });
    }
}

async function autorizarFacturas(req, res) {
    try {
        const { autorizar } = req.body || {};
        if (req.usuario.rol !== "Emprendedor") return res.status(403).json({ error: "Solo el cliente puede gestionar este permiso" });
        if (typeof autorizar !== "boolean" || !/^[1-9]\d{0,9}$/.test(req.params.id)) {
            return res.status(400).json({ error: "Indica un vínculo y una autorización válidos" });
        }
        const id = req.params.id;
        const propietario = req.usuario.idUsuario;
        const resultado = await enTransaccion(async conexion => {
            const [[actual]] = await conexion.execute(
                "SELECT idContador FROM ClienteContador WHERE idVinculo = ? AND idCliente = ?", [id, propietario]
            );
            if (!actual) return 404;
            // La revocación también está disponible si el contador se encuentra inactivo.
            const participantes = await bloquearParticipantes(conexion, actual.idContador, propietario);
            if (autorizar && !participantes) return 409;
            const [[vinculo]] = await conexion.execute(
                "SELECT estado, facturasAutorizadas FROM ClienteContador WHERE idVinculo = ? AND idCliente = ? FOR UPDATE",
                [id, propietario]
            );
            if (!vinculo) return 404;
            if (autorizar && vinculo.estado !== "Aceptado") return 409;
            if (Boolean(vinculo.facturasAutorizadas) === autorizar) return 200;
            await conexion.execute("UPDATE ClienteContador SET facturasAutorizadas = ? WHERE idVinculo = ?", [autorizar, id]);
            const accion = `Acceso a facturas ${autorizar ? "autorizado" : "revocado"} para el vínculo #${id}`;
            await registrarActividad(propietario, accion, "Clientes", req.ip, conexion);
            await registrarActividad(actual.idContador, accion, "Clientes", req.ip, conexion);
            return 200;
        });
        if (resultado === 404) return res.status(404).json({ error: "Vínculo no encontrado" });
        if (resultado === 409) return res.status(409).json({ error: "Se necesita un vínculo aceptado entre cuentas activas con roles compatibles" });
        return res.json({ facturasAutorizadas: autorizar });
    } catch (error) {
        console.error("Error al cambiar el permiso de facturas:", error.code || error.name);
        return res.status(500).json({ error: "No se pudo cambiar el permiso de facturas" });
    }
}

module.exports = { listar, solicitar, responder, eliminar, autorizarFacturas };

const pool = require("../config/db");

async function listar(req, res) {
    try {
        const [metodos] = await pool.query(
            "SELECT idMetodoPago, nombreMetodo FROM MetodoPago WHERE estado = 'Activo' ORDER BY nombreMetodo"
        );
        return res.json(metodos);
    } catch (error) {
        console.error("Error de API:", error.code || error.name);
        return res.status(500).json({ error: "Error al obtener los métodos de pago" });
    }
}

async function listarTodos(req, res) {
    try {
        const [metodos] = await pool.query(
            "SELECT idMetodoPago, nombreMetodo, descripcion, estado FROM MetodoPago ORDER BY nombreMetodo"
        );
        return res.json(metodos);
    } catch (error) {
        console.error("Error de API:", error.code || error.name);
        return res.status(500).json({ error: "Error al obtener los métodos de pago" });
    }
}

async function crear(req, res) {
    try {
        const { nombreMetodo, descripcion } = req.body;

        if (!nombreMetodo) {
            return res.status(400).json({ error: "El nombre del método de pago es obligatorio" });
        }

        const [resultado] = await pool.query(
            "INSERT INTO MetodoPago (nombreMetodo, descripcion) VALUES (?, ?)",
            [nombreMetodo, descripcion || null]
        );

        return res.status(201).json({ mensaje: "Método de pago creado", id: resultado.insertId });

    } catch (error) {
        console.error("Error de API:", error.code || error.name);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ error: "Ya existe un método de pago con ese nombre" });
        }
        return res.status(500).json({ error: "Error al crear el método de pago" });
    }
}

async function cambiarEstado(req, res) {
    try {
        const { id } = req.params;
        const { estado } = req.body;

        if (!["Activo", "Inactivo"].includes(estado)) {
            return res.status(400).json({ error: "Estado inválido" });
        }

        const [resultado] = await pool.query(
            "UPDATE MetodoPago SET estado = ? WHERE idMetodoPago = ?",
            [estado, id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ error: "Método de pago no encontrado" });
        }

        return res.json({ mensaje: "Método de pago actualizado" });

    } catch (error) {
        console.error("Error de API:", error.code || error.name);
        return res.status(500).json({ error: "Error al actualizar el método de pago" });
    }
}

module.exports = { listar, listarTodos, crear, cambiarEstado };

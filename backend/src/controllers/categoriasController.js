const pool = require("../config/db");

async function listar(req, res) {
    try {
        const { tipo } = req.query;

        let sql = "SELECT idCategoria, codigoCategoria, nombreCategoria, tipo FROM CategoriaFinanciera WHERE estado = 'Activa'";
        const params = [];

        if (tipo) {
            sql += " AND tipo = ?";
            params.push(tipo === "ingreso" ? "Ingreso" : "Egreso");
        }

        sql += " ORDER BY nombreCategoria";

        const [categorias] = await pool.query(sql, params);
        return res.json(categorias);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Error al obtener las categorías" });
    }
}

async function listarTodas(req, res) {
    try {
        const [categorias] = await pool.query(
            "SELECT idCategoria, codigoCategoria, nombreCategoria, tipo, estado FROM CategoriaFinanciera ORDER BY tipo, nombreCategoria"
        );
        return res.json(categorias);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Error al obtener las categorías" });
    }
}

async function crear(req, res) {
    try {
        const { nombreCategoria, tipo, descripcion } = req.body;

        if (!nombreCategoria || !["Ingreso", "Egreso"].includes(tipo)) {
            return res.status(400).json({ error: "Nombre y tipo (Ingreso/Egreso) son obligatorios" });
        }

        const prefijo = tipo === "Ingreso" ? "ING" : "EGR";
        const [[{ cantidad }]] = await pool.query(
            "SELECT COUNT(*) AS cantidad FROM CategoriaFinanciera WHERE tipo = ?",
            [tipo]
        );
        const codigoCategoria = `${prefijo}-${String(cantidad + 1).padStart(3, "0")}`;

        const [resultado] = await pool.query(
            `INSERT INTO CategoriaFinanciera (codigoCategoria, nombreCategoria, tipo, descripcion)
             VALUES (?, ?, ?, ?)`,
            [codigoCategoria, nombreCategoria, tipo, descripcion || null]
        );

        return res.status(201).json({ mensaje: "Categoría creada", id: resultado.insertId, codigoCategoria });

    } catch (error) {
        console.error(error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ error: "Ya existe una categoría con ese nombre y tipo" });
        }
        return res.status(500).json({ error: "Error al crear la categoría" });
    }
}

async function cambiarEstado(req, res) {
    try {
        const { id } = req.params;
        const { estado } = req.body;

        if (!["Activa", "Inactiva"].includes(estado)) {
            return res.status(400).json({ error: "Estado inválido" });
        }

        const [resultado] = await pool.query(
            "UPDATE CategoriaFinanciera SET estado = ? WHERE idCategoria = ?",
            [estado, id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ error: "Categoría no encontrada" });
        }

        return res.json({ mensaje: "Categoría actualizada" });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Error al actualizar la categoría" });
    }
}

module.exports = { listar, listarTodas, crear, cambiarEstado };

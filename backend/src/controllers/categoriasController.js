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

module.exports = { listar };

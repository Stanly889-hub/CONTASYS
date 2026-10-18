const pool = require("../config/db");

async function listar(req, res) {
    try {
        const [metodos] = await pool.query(
            "SELECT idMetodoPago, nombreMetodo FROM MetodoPago WHERE estado = 'Activo' ORDER BY nombreMetodo"
        );
        return res.json(metodos);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Error al obtener los métodos de pago" });
    }
}

module.exports = { listar };

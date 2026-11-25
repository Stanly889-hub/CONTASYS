const { centavos } = require("./finanzas");

class DatoFinancieroInvalido extends Error {}

function montoValido(valor) {
    const texto = typeof valor === "number" || typeof valor === "string" ? String(valor) : "";
    if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(texto) || centavos(texto) <= 0n) {
        throw new DatoFinancieroInvalido("Indica un monto positivo de hasta $9.999.999.999,99 y máximo dos decimales");
    }
    return texto;
}

function fechaValida(valor) {
    if (typeof valor !== "string" || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(valor)) {
        throw new DatoFinancieroInvalido("Indica una fecha válida en formato AAAA-MM-DD");
    }
    const fecha = new Date(`${valor}T00:00:00Z`);
    if (!Number.isFinite(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== valor) {
        throw new DatoFinancieroInvalido("Indica una fecha válida");
    }
    return valor;
}

function validarRango(desde, hasta, obligatorio = true) {
    if (obligatorio || desde !== undefined) fechaValida(desde);
    if (obligatorio || hasta !== undefined) fechaValida(hasta);
    if (desde && hasta && desde > hasta) throw new DatoFinancieroInvalido("La fecha inicial no puede ser mayor que la final");
}

function idValido(valor, campo = "Identificador") {
    if (!["string", "number"].includes(typeof valor) || !/^[1-9]\d{0,9}$/.test(String(valor)) || Number(valor) > 2147483647) {
        throw new DatoFinancieroInvalido(`${campo} inválido`);
    }
    return Number(valor);
}

function textoValido(valor, campo, maximo, opcional = false, medir = texto => [...texto].length) {
    if (opcional && (valor === undefined || valor === null || valor === "")) return null;
    if (typeof valor !== "string" || !valor.trim() || medir(valor.trim()) > maximo) {
        throw new DatoFinancieroInvalido(`${campo} es obligatorio o supera la longitud permitida`);
    }
    return valor.trim();
}

function estadoValido(valor, permitidos, anterior) {
    if (valor === undefined) return anterior;
    if (!permitidos.includes(valor)) throw new DatoFinancieroInvalido("Estado inválido");
    return valor;
}

function responderError(res, error, mensaje) {
    if (error instanceof DatoFinancieroInvalido) return res.status(400).json({ error: error.message });
    if (error.code === "CONTASYS_POOL_TIMEOUT" || error.message === "Queue limit reached.") {
        return res.status(503).json({ error: "La base de datos está ocupada. Intenta de nuevo en unos segundos." });
    }
    if (["ER_SIGNAL_EXCEPTION", "ER_NO_REFERENCED_ROW_2", "ER_CHECK_CONSTRAINT_VIOLATED",
        "ER_DATA_TOO_LONG", "ER_WARN_DATA_OUT_OF_RANGE", "ER_TRUNCATED_WRONG_VALUE"].includes(error.code)) {
        return res.status(400).json({ error: "Revisa los valores y los catálogos seleccionados" });
    }
    console.error(mensaje, error.code || error.name);
    return res.status(500).json({ error: mensaje });
}

module.exports = { DatoFinancieroInvalido, montoValido, fechaValida, validarRango, idValido, textoValido, estadoValido, responderError };

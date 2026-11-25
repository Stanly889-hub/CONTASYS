const { DatoFinancieroInvalido, idValido, fechaValida } = require("./validacionFinanciera");

function paginacion(query, { cursor = true, defecto = 50, maximo = 100 } = {}) {
    if (query.limite === undefined && (!cursor || query.cursor === undefined)) return null;
    const limite = query.limite === undefined ? defecto : idValido(query.limite, "Tamaño de página");
    if (limite > maximo) throw new DatoFinancieroInvalido(`El tamaño máximo de página es ${maximo}`);
    if (!cursor || query.cursor === undefined) return { limite };
    if (typeof query.cursor !== "string" || !/^[\w-]{1,100}$/.test(query.cursor)) {
        throw new DatoFinancieroInvalido("Cursor inválido");
    }
    const [fecha, id, sobrante] = Buffer.from(query.cursor, "base64url").toString("utf8").split("|");
    if (sobrante || !/^\d{4}-\d{2}-\d{2}(?: (?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d)?$/.test(fecha)) {
        throw new DatoFinancieroInvalido("Cursor inválido");
    }
    fechaValida(fecha.slice(0, 10));
    return { limite, fecha, id: idValido(id, "Cursor") };
}

function respuestaPagina(filas, pagina, columnaFecha, columnaId) {
    if (!pagina) return filas;
    const registros = filas.slice(0, pagina.limite);
    const ultimo = registros.at(-1);
    const siguiente = filas.length > pagina.limite
        ? Buffer.from(`${ultimo[columnaFecha]}|${ultimo[columnaId]}`).toString("base64url") : null;
    return { registros, siguiente };
}

module.exports = { paginacion, respuestaPagina };

const origenesLocales = ["http://localhost:5500", "http://127.0.0.1:5500"];

function opcionesCors(entorno = process.env) {
    const produccion = entorno.NODE_ENV === "production";
    const configurados = (entorno.CORS_ORIGIN || "").split(",").map(valor => valor.trim()).filter(Boolean);
    for (const origen of configurados) {
        let url;
        try {
            url = new URL(origen);
        } catch {
            throw new Error("CORS_ORIGIN debe contener orígenes completos separados por comas");
        }
        if (url.origin !== origen || !["https:", "http:"].includes(url.protocol) ||
            (produccion && url.protocol !== "https:")) {
            throw new Error("CORS_ORIGIN requiere orígenes sin rutas y HTTPS en producción");
        }
    }

    const permitidos = new Set(produccion ? configurados : [...origenesLocales, ...configurados]);
    return {
        origin: (origen, callback) => callback(null, permitidos.has(origen)),
        methods: ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Authorization", "Content-Type"]
    };
}

module.exports = { opcionesCors };

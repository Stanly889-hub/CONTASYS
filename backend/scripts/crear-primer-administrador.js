const { createInterface } = require("node:readline/promises");
const { Writable } = require("node:stream");
const bcrypt = require("bcryptjs");
const pool = require("../src/config/db");
const { enTransaccion } = require("../src/utils/transaccion");

async function crearPrimerAdministrador(datos) {
    const hash = await bcrypt.hash(datos.password, 12);
    return enTransaccion(async conexion => {
        const [[rol]] = await conexion.execute(
            "SELECT idRol FROM Rol WHERE nombreRol = 'Administrador' FOR UPDATE"
        );
        if (!rol) throw new Error("El esquema no contiene el rol Administrador");

        const [[existente]] = await conexion.execute(
            "SELECT idUsuario FROM Usuario WHERE idRol = ? LIMIT 1", [rol.idRol]
        );
        if (existente) throw new Error("Ya existe un administrador. Usa el panel de usuarios.");

        const [usuario] = await conexion.execute(
            `INSERT INTO Usuario (documento, nombre, apellido, correo, password_hash, fechaRegistro, idRol)
             VALUES (?, ?, ?, ?, ?, CURDATE(), ?)`,
            [datos.documento, datos.nombre, datos.apellido, datos.correo, hash, rol.idRol]
        );
        await conexion.execute(
            `INSERT INTO Suscripcion (tipoPlan, fechaInicio, fechaFin, idUsuario)
             VALUES ('Free', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 YEAR), ?)`,
            [usuario.insertId]
        );
        return usuario.insertId;
    });
}

async function ejecutar() {
    if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("Usa una terminal interactiva");
    let ocultar = false;
    const salida = new Writable({
        write(datos, codificacion, terminar) {
            if (!ocultar) process.stdout.write(datos);
            terminar();
        }
    });
    const consola = createInterface({ input: process.stdin, output: salida, terminal: true, historySize: 0 });
    try {
        if (!process.env.DB_NAME) throw new Error("Configura DB_NAME antes de continuar");
        const confirmacion = await consola.question(`Escribe el nombre de la base (${process.env.DB_NAME}) para confirmar: `);
        if (confirmacion !== process.env.DB_NAME) throw new Error("Operación cancelada");

        const documento = (await consola.question("Documento: ")).trim();
        const nombre = (await consola.question("Nombre: ")).trim();
        const apellido = (await consola.question("Apellido: ")).trim();
        const correo = (await consola.question("Correo: ")).trim();
        if (!documento || !nombre || !apellido || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
            throw new Error("Completa los datos e indica un correo válido");
        }

        process.stdout.write("Contraseña nueva: ");
        ocultar = true;
        const password = await consola.question("");
        ocultar = false;
        process.stdout.write("\n");
        if (password.length < 12 || Buffer.byteLength(password) > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
            throw new Error("Usa al menos 12 caracteres con letras y números, hasta 72 bytes");
        }

        const id = await crearPrimerAdministrador({ documento, nombre, apellido, correo, password });
        console.log(`Administrador creado (ID ${id}).`);
    } finally {
        consola.close();
    }
}

if (require.main === module) {
    ejecutar().catch(error => {
        console.error(error.code ? `Error de base de datos: ${error.code}` : error.message);
        process.exitCode = 1;
    }).finally(() => pool.end());
}

module.exports = { crearPrimerAdministrador };

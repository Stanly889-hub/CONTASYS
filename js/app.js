// ===== USUARIOS =====
function obtenerUsuarios() {
    return JSON.parse(localStorage.getItem("usuarios")) || [];
}

function guardarUsuarios(usuarios) {
    localStorage.setItem("usuarios", JSON.stringify(usuarios));
}

function registrarUsuario(usuario) {
    let usuarios = obtenerUsuarios();

    let existe = usuarios.find(u => u.cedula === usuario.cedula);

    if (existe) {
        mostrarNotificacion("El usuario ya existe", "error");
        return false;
    }

    usuarios.push(usuario);
    guardarUsuarios(usuarios);
    return true;
}

function login(usuarioInput, passwordInput) {
    let usuarios = obtenerUsuarios();

    return usuarios.find(u =>
        (u.nombre === usuarioInput || u.cedula === usuarioInput) &&
        u.password === passwordInput
    );
}

// ===== NOTIFICACIONES =====
function mostrarNotificacion(mensaje, tipo) {
    let div = document.createElement("div");
    div.className = "notificacion " + tipo;
    div.textContent = mensaje;

    document.body.appendChild(div);

    setTimeout(() => {
        div.remove();
    }, 3000);
}

// ===== MOVIMIENTOS =====
function obtenerMovimientos() {
    return JSON.parse(localStorage.getItem("movimientos")) || [];
}

function guardarMovimiento(tipo, monto, descripcion) {
    let movimientos = obtenerMovimientos();

    movimientos.push({
        tipo,
        monto: Number(monto),
        descripcion,
        fecha: new Date().toLocaleDateString()
    });

    localStorage.setItem("movimientos", JSON.stringify(movimientos));
}
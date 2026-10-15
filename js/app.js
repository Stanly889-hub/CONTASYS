// ===== CATALOGOS =====
const CATEGORIAS = [
    { nombre: 'Ventas', tipo: 'ingreso' },
    { nombre: 'Servicios', tipo: 'ingreso' },
    { nombre: 'Salario', tipo: 'ingreso' },
    { nombre: 'Arriendo', tipo: 'egreso' },
    { nombre: 'Servicios Publicos', tipo: 'egreso' },
    { nombre: 'Papeleria', tipo: 'egreso' },
    { nombre: 'Transporte', tipo: 'egreso' }
];

const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Tarjeta Debito', 'Tarjeta Credito', 'Nequi', 'Daviplata'];

function obtenerCategorias(tipo) {
    return CATEGORIAS.filter(c => c.tipo === tipo).map(c => c.nombre);
}

function obtenerMetodosPago() {
    return METODOS_PAGO;
}

function formatoCOP(monto) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0
    }).format(monto);
}

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

function login(usuarioInput, passwordHashInput) {
    let usuarios = obtenerUsuarios();

    return usuarios.find(u =>
        (u.nombre === usuarioInput || u.cedula === usuarioInput) &&
        u.password === passwordHashInput
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

// ===== MOVIMIENTOS (Ingresos y Egresos) =====
function generarId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function obtenerMovimientos() {
    return JSON.parse(localStorage.getItem("movimientos")) || [];
}

function guardarMovimientos(movimientos) {
    localStorage.setItem("movimientos", JSON.stringify(movimientos));
}

function guardarMovimiento(movimiento) {
    let movimientos = obtenerMovimientos();
    movimiento.id = generarId();
    movimientos.push(movimiento);
    guardarMovimientos(movimientos);
    return movimiento;
}

function actualizarMovimiento(id, datosNuevos) {
    let movimientos = obtenerMovimientos();
    let idx = movimientos.findIndex(m => m.id === id);
    if (idx === -1) return false;

    movimientos[idx] = { ...movimientos[idx], ...datosNuevos };
    guardarMovimientos(movimientos);
    return true;
}

function eliminarMovimiento(id) {
    let movimientos = obtenerMovimientos();
    let nuevos = movimientos.filter(m => m.id !== id);
    guardarMovimientos(nuevos);
}

function filtrarMovimientos(tipo, fechaDesde, fechaHasta, categoria) {
    return obtenerMovimientos().filter(m => {
        if (m.tipo !== tipo) return false;
        if (fechaDesde && m.fecha < fechaDesde) return false;
        if (fechaHasta && m.fecha > fechaHasta) return false;
        if (categoria && m.categoria !== categoria) return false;
        return true;
    });
}

// ===== PRESUPUESTOS =====
function obtenerPresupuestos() {
    return JSON.parse(localStorage.getItem("presupuestos")) || [];
}

function guardarPresupuestos(arr) {
    localStorage.setItem("presupuestos", JSON.stringify(arr));
}

function guardarPresupuesto(p) {
    let arr = obtenerPresupuestos();
    p.id = generarId();
    arr.push(p);
    guardarPresupuestos(arr);
    return p;
}

function actualizarPresupuesto(id, datos) {
    let arr = obtenerPresupuestos();
    let idx = arr.findIndex(p => p.id === id);
    if (idx === -1) return false;
    arr[idx] = { ...arr[idx], ...datos };
    guardarPresupuestos(arr);
    return true;
}

function eliminarPresupuesto(id) {
    let arr = obtenerPresupuestos();
    guardarPresupuestos(arr.filter(p => p.id !== id));
}

function calcularEjecutadoPresupuesto(presupuesto) {
    return obtenerMovimientos()
        .filter(m => m.categoria === presupuesto.categoria &&
                     m.fecha >= presupuesto.fechaInicio &&
                     m.fecha <= presupuesto.fechaFin)
        .reduce((s, m) => s + m.monto, 0);
}

// ===== REPORTES Y ANALISIS =====
function filtrarMovimientosPorPeriodo(desde, hasta) {
    return obtenerMovimientos().filter(m => m.fecha >= desde && m.fecha <= hasta);
}

function totalesPorTipo(movimientos) {
    let ingresos = movimientos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0);
    let egresos = movimientos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0);
    return { ingresos, egresos, balance: ingresos - egresos };
}

function gastosPorCategoria(movimientos) {
    let mapa = {};
    movimientos.filter(m => m.tipo === 'egreso').forEach(m => {
        mapa[m.categoria] = (mapa[m.categoria] || 0) + m.monto;
    });
    return mapa;
}
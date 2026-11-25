const coloresIndicadores = ["#2563EB", "#60A5FA", "#0F172A", "#D97706", "#0F766E", "#6366F1"];
const copCompacto = new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 });

function ejeIndicadores() {
    return { beginAtZero: true, grid: { color: "#E2E8F0" }, ticks: { maxTicksLimit: 6, color: "#475569", callback: valor => copCompacto.format(valor) } };
}

function opcionesIndicadores(leyenda = false) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
            legend: { display: leyenda, position: "bottom", labels: { usePointStyle: true, boxWidth: 8, color: "#475569" } },
            tooltip: {
                backgroundColor: "#0F172A",
                padding: 10,
                callbacks: {
                    label: ({ dataset, raw, label }) => `${dataset.label || label}: ${formatoCOPExacto(raw)}`
                }
            }
        }
    };
}

function prepararGraficaIndicadores(id, tieneDatos) {
    const lienzo = document.getElementById(id);
    lienzo.parentElement.hidden = !tieneDatos;
    lienzo.closest(".ra-chart").querySelector(".ra-chart-empty").hidden = tieneDatos;
    return lienzo;
}

function marcarSignoIndicador(id, monto) {
    const valor = Number(monto);
    document.getElementById(id).dataset.signo = valor < 0 ? "negativo" : valor > 0 ? "positivo" : "neutro";
}

function mostrarPendientesIndicadores(pendientes) {
    const indicador = document.getElementById("resumenPendientes");
    indicador.textContent = textoPendientes(pendientes);
    indicador.classList.toggle("ra-pending-neutral", centavosCOP(pendientes.ingresos) === 0n && centavosCOP(pendientes.egresos) === 0n);
}

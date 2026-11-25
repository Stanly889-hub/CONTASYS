describe("Finanzas y exportaciones", () => {
    beforeEach(() => cy.entrar("emprendedora"));

    it("pagina los ingresos, registra un egreso y conserva presupuesto y análisis", () => {
        cy.visit("/movimientos.html?tipo=ingreso");
        cy.get("#tablaMovimientos tr").should("have.length", 50);
        cy.contains("button", "Siguiente").click();
        cy.contains("Página 2").should("be.visible");
        cy.visit("/movimientos.html?tipo=egreso");
        cy.get("#monto").type("9.23");
        cy.get("#desc").type("Egreso integral");
        cy.get("#categoria").select("4");
        cy.get("#metodoPago").select("1");
        cy.get("#btnGuardar").click();
        cy.get("#tablaMovimientos").should("contain.text", "Egreso integral");
        cy.visit("/presupuestos.html");
        cy.get("#nombrePresupuesto").type("Presupuesto integral");
        cy.get("#categoria").select("4");
        cy.get("#montoPresupuesto").type("10.00");
        cy.get("#btnGuardarPresupuesto").click();
        cy.get("#tablaPresupuestos").should("contain.text", "Presupuesto integral");
        cy.get("#tablaPresupuestos").should("contain.text", "92%");
        cy.visit("/analisis.html");
        cy.get("#graficaTendencia").should("be.visible");
        cy.get("#tablaTopCategorias").should("contain.text", "Arriendo");
    });

    it("descarga un reporte PDF y un Excel Premium con las 124 filas", () => {
        cy.visit("/reportes.html");
        cy.get("#fechaDesde").clear().type("2026-01-15");
        cy.get("#fechaHasta").clear().type("2026-01-15");
        cy.contains("button", "Generar reporte").click();
        cy.get("#tablaDetalle tr").should("have.length", 100);
        cy.get("#detalleSiguiente").click();
        cy.get("#tablaDetalle tr").should("have.length", 24);
        const base = "reporte_contasys_2026-01-15_a_2026-01-15";
        cy.contains("button", "Exportar PDF").click();
        cy.readFile(`${Cypress.config("downloadsFolder")}/${base}.pdf`, null).should("exist");
        cy.task("validarPdf", { archivo: base + ".pdf", textos: ["CONTASYS", "12,40", "124"] }).should("eq", true);
        cy.contains("button", "Exportar Excel").click();
        cy.readFile(`${Cypress.config("downloadsFolder")}/${base}.xlsx`, null).should("exist");
        cy.task("validarExcel", base + ".xlsx").then(r => {
            expect(r.filas).to.eq(124);
            expect(r.ultimo).to.include("Ítem 124");
            expect(r.ultimo).to.include("café");
            expect(r.monto).to.eq(0.1);
        });
    });
});

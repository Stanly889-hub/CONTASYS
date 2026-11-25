describe("Facturación, cuenta y diseño", () => {
    beforeEach(() => cy.entrar("emprendedora"));

    it("emite, guarda, descarga y recupera una factura desde el historial", () => {
        cy.intercept("GET", "**/api/facturas?*").as("cargarFacturas");
        cy.intercept("POST", "**/api/facturas").as("emitirFactura");
        cy.visit("/facturacion.html");
        cy.wait("@cargarFacturas").its("response.statusCode").should("eq", 200);
        cy.get("#nombreCliente").type("Receptor Álvarez con razón comercial extensa");
        cy.get("#documentoCliente").type("DEMO-700");
        cy.get("#conceptoFactura").type("Diseño y revisión académica");
        cy.get("#valorFactura").type("123.45");
        cy.contains("button", "Emitir y descargar PDF").click();
        cy.wait("@emitirFactura").its("response.statusCode").should("eq", 201);
        cy.wait("@cargarFacturas").its("response.statusCode").should("eq", 200);
        cy.get("#historialFacturas").should("contain.text", "Receptor Álvarez");
        cy.get('#filtrosFacturas [name="buscar"]').type("DEMO-700");
        cy.contains("button", "Filtrar").click();
        cy.get("#historialFacturas tr").should("have.length", 1);
        cy.contains("button", "Ver detalle").click();
        cy.get("#detalleFactura").should("contain.text", "Diseño y revisión académica");
        cy.get("#detalleTitulo").should("contain.text", "Pendiente");
        cy.get("#detalleTitulo").invoke("text").then(titulo => {
            const archivo = titulo.split(" · ")[0] + ".pdf";
            cy.readFile(`${Cypress.config("downloadsFolder")}/${archivo}`, null).should("exist");
            cy.task("validarPdf", { archivo, textos: ["Documento comercial interno", "Álvarez", "123,45", "Pendiente"] }).should("eq", true);
        });
        cy.screenshot("factura-emitida-real");
    });

    it("comprueba navegación, formularios y tablas de factura en cinco anchos", () => {
        for (const ancho of [375, 768, 1024, 1366, 1920]) {
            cy.viewport(ancho, 900);
            cy.visit("/facturacion.html");
            cy.get("#facturaForm").should("be.visible");
            cy.get("#nombreCliente").focus().should("be.focused");
            cy.get("#historialFacturas").should("exist");
            cy.document().then(doc => {
                expect(doc.documentElement.scrollWidth, `desbordamiento a ${ancho}px`).to.be.at.most(ancho + 1);
            });
        }
        cy.visit("/cuenta.html");
        cy.get("#planActual").should("contain.text", "Premium");
        cy.get("#tablaActividad").should("exist");
    });

    it("recupera la navegación, el chat y las gráficas de reportes en móvil y escritorio", () => {
        for (const ancho of [375, 1024]) {
            cy.viewport(ancho, 900);
            cy.visit("/dashboard.html");
            if (ancho === 375) cy.contains("button", "Menú").click();
            cy.get('[data-page="mensajes"] a').should("be.visible").click();
            cy.get("#listaContactos").should("contain.text", "Contador");
            cy.get("#listaContactos").contains("Contador Prueba").click();
            cy.get("#chatInput").should("be.visible");
            cy.document().then(doc => expect(doc.documentElement.scrollWidth, `chat a ${ancho}px`).to.be.at.most(ancho + 1));
            if (ancho === 375) cy.contains("button", "Menú").click();
            cy.get('[data-page="reportes"] a').click();
            cy.get("#fechaDesde").should("be.visible");
            cy.get("#fechaDesde").clear().type("2026-01-15");
            cy.get("#fechaHasta").clear().type("2026-01-15");
            cy.contains("button", "Generar reporte").click();
            cy.get("#graficaIngresosEgresos").should("be.visible");
            cy.document().then(doc => expect(doc.documentElement.scrollWidth, `reportes a ${ancho}px`).to.be.at.most(ancho + 1));
        }
    });
});

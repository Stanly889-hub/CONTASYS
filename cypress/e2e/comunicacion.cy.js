describe("Clientes, mensajes y notificaciones", () => {
    it("solicita acceso, lo acepta y permite alternar entre cliente y cuenta propia", () => {
        cy.entrar("contador");
        cy.visit("/clientes.html");
        cy.get("#correoCliente").type("emprendedora@example.invalid");
        cy.contains("button", "Solicitar acceso").click();
        cy.get("#tablaClientes").should("contain.text", "Pendiente de respuesta");
        cy.contains("button", "Cerrar sesión").click();
        cy.entrar("emprendedora");
        cy.visit("/notificaciones.html");
        cy.get("#listaNotificaciones").should("contain.text", "solicita ver tus finanzas");
        cy.contains("button", "Marcar como vista").first().click();
        cy.visit("/cuenta.html");
        cy.contains("button", "Aceptar").click();
        cy.contains("button", "Autorizar lectura de facturas").click();
        cy.contains("button", "Revocar acceso a facturas").should("be.visible");
        cy.contains("button", "Cerrar sesión").click();
        cy.entrar("contador");
        cy.visit("/clientes.html");
        cy.contains("button", "Ver datos").click();
        cy.get(".banner-cliente").should("contain.text", "Emprendedora");
        cy.visit("/facturacion.html");
        cy.get(".banner-cliente").should("be.visible");
        cy.get("#seccionFactura").should("not.be.visible");
        cy.get(".banner-cliente").contains("button", "Volver a mis datos").click();
        cy.get("#seccionFactura").should("be.visible");
    });

    it("envía y recupera un mensaje real en la otra cuenta", () => {
        cy.entrar("emprendedora");
        cy.visit("/mensajes.html");
        cy.get("#listaContactos").contains("Contador Prueba").click();
        cy.get("#chatInput").type("Mensaje integral con café");
        cy.contains("button", "Enviar").click();
        cy.get("#chatMensajes").should("contain.text", "Mensaje integral con café");
        cy.contains("button", "Cerrar sesión").click();
        cy.entrar("contador");
        cy.visit("/mensajes.html");
        cy.get("#listaContactos").contains("Emprendedora Prueba").click();
        cy.get("#chatMensajes").should("contain.text", "Mensaje integral con café");
    });
});

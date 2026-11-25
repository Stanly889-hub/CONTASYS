describe("Autenticación y permisos", () => {
    it("rechaza credenciales inválidas y redirige al abrir una página protegida", () => {
        cy.visit("/facturacion.html");
        cy.location("pathname").should("eq", "/index.html");
        cy.get("#correo").type("emprendedora@example.invalid");
        cy.get("#password").type("FicticiaIncorrecta99", { log: false });
        cy.contains("button", "Ingresar").click();
        cy.contains(/Credenciales inválidas/i).should("be.visible");
        cy.location("pathname").should("eq", "/index.html");
    });

    it("registra una cuenta desde la interfaz, rechaza duplicados y oculta Administrador", () => {
        const correo = "registro-e2e@example.invalid";
        function enviar(documento) {
            cy.visit("/registro.html");
            cy.get("#rol option").should("not.contain.text", "Administrador");
            cy.get("#nombre").type("Registro");
            cy.get("#apellido").type("Prueba");
            cy.get("#cedula").type(documento);
            cy.get("#correo").type(correo);
            cy.get("#rol").select("Contador");
            cy.get("#password, #confirmPassword").each(campo => cy.wrap(campo).type("ContasysPrueba2026!", { log: false }));
            cy.contains("button", "Registrarse").click();
        }
        enviar("999991");
        cy.location("pathname").should("eq", "/index.html");
        enviar("999992");
        cy.contains(/ya existe/i).should("be.visible");
    });

    it("revoca la sesión al cerrar y comprueba navegación de los tres roles", () => {
        cy.entrar("admin");
        cy.get('[data-page="usuarios"] a').click();
        cy.get("#tablaUsuarios").should("contain.text", "Emprendedora");
        cy.get('[data-page="configuracion"] a').click();
        cy.get("#tablaCategorias").should("contain.text", "Ventas");
        cy.get("#nombreMetodo").type("Pago de prueba integral");
        cy.contains("button", "Crear método").click();
        cy.get("#tablaMetodos").should("contain.text", "Pago de prueba integral");
        cy.contains("button", "Cerrar sesión").click();
        cy.location("pathname").should("eq", "/index.html");
        cy.entrar("contador");
        cy.get('[data-page="clientes"] a').should("be.visible");
        cy.get('[data-page="usuarios"]').should("not.be.visible");
        cy.contains("button", "Cerrar sesión").click();
        cy.entrar("emprendedora");
        cy.get('[data-page="clientes"]').should("not.be.visible");
        cy.get('[data-page="facturacion"] a').should("be.visible");
    });
});

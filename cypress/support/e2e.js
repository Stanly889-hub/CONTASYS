Cypress.Commands.add("entrar", cuenta => {
    cy.visit("/index.html");
    cy.get("#correo").type(`${cuenta}@example.invalid`);
    cy.get("#password").type("ContasysPrueba2026!", { log: false });
    cy.contains("button", "Ingresar").click();
    cy.location("pathname").should("eq", "/dashboard.html");
    cy.get("#nombreUsuarioActual").should("exist");
});

describe("Home", () => {
  beforeEach(() => cy.visit("/"));

  it("states the thesis and links to Browse and Register", () => {
    cy.contains("h1", "Trust that travels").should("be.visible");
    cy.contains("Don Nate is a public, on-chain registry").should("be.visible");
    cy.contains("a", "Browse the registry").should("have.attr", "href", "/browse");
    cy.contains("a", "Register an institution").should("have.attr", "href", "/register");
  });

  it("names the three-step process in order", () => {
    cy.get(".step").should("have.length", 3);
    cy.get(".step").eq(0).should("contain.text", "Verify");
    cy.get(".step").eq(1).should("contain.text", "Review");
    cy.get(".step").eq(2).should("contain.text", "Give");
  });

  it("is honest about status — pre-launch, testnet, no payment rails", () => {
    cy.contains("#status", "proof of concept").should("be.visible");
    cy.contains("#status", "Stellar testnet").should("be.visible");
  });

  it("navigates to Browse and Register via the header", () => {
    cy.get("nav.site").contains("a", "Browse").click();
    cy.location("pathname").should("eq", "/browse");

    cy.get("nav.site").contains("a", "Register").click();
    cy.location("pathname").should("eq", "/register");
  });
});

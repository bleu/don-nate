// Hits the live testnet contract (deployments/testnet.json) — no stubbing. The one seed
// entry from that deployment ("Smoke Test Foundation", GDEY…CGAD, Tier 3, verified) is a
// permanent fixture we deliberately left on-chain for exactly this: a known-good row these
// specs can assert against without mocking Soroban RPC. If testnet state resets, reseed via
// `stellar contract invoke ... submit_report` + `approve_verification` (see docs/DESIGN.md).

describe("Browse", () => {
  beforeEach(() => cy.visit("/browse"));

  it("lists the registry read-only, no wallet required", () => {
    cy.contains("Loading from Stellar testnet").should("be.visible");
    cy.contains(".name", "Smoke Test Foundation", { timeout: 20000 }).should("be.visible");
    cy.contains(".badge.verified", "Verified").should("be.visible");
    cy.contains(".tier-tag", "Tier 3").should("be.visible");
    cy.get("nav.site").contains("Connect wallet").should("be.visible");
  });

  it("searches by name", () => {
    cy.contains(".name", "Smoke Test Foundation", { timeout: 20000 }).should("be.visible");
    cy.get(".search-input").type("smoke");
    cy.contains(".name", "Smoke Test Foundation").should("be.visible");
    cy.get(".list-row:not(.head)").should("have.length", 1);
  });

  it("searches by address and shows no-match state for a bad query", () => {
    cy.contains(".name", "Smoke Test Foundation", { timeout: 20000 }).should("be.visible");
    cy.get(".search-input").type("GDEY");
    cy.contains(".name", "Smoke Test Foundation").should("be.visible");

    cy.get(".search-input").clear().type("this-institution-does-not-exist");
    cy.contains("No matches.").should("be.visible");
  });
});

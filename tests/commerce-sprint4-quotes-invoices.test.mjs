import assert from "node:assert/strict";
import test from "node:test";
import { defaultRolePermissions, permissionCatalog } from "../src/lib/staff-permissions.ts";
import { commerceRoleLabels } from "../src/lib/commerce-permissions.ts";

test("Sprint 4: Role VENDEUR is configured with quotes and sales permissions", () => {
  assert.ok(defaultRolePermissions.VENDEUR, "Role VENDEUR should exist in defaultRolePermissions");
  const vendeurPerms = defaultRolePermissions.VENDEUR;
  
  assert.ok(vendeurPerms.includes("quotes.view"), "VENDEUR must have quotes.view");
  assert.ok(vendeurPerms.includes("quotes.create"), "VENDEUR must have quotes.create");
  assert.ok(vendeurPerms.includes("quotes.convert"), "VENDEUR must have quotes.convert");
  assert.ok(vendeurPerms.includes("orders.create"), "VENDEUR must have orders.create");
  assert.ok(vendeurPerms.includes("invoices.view"), "VENDEUR must have invoices.view");
});

test("Sprint 4: Strict Separation of Duties - VENDEUR cannot cash payments", () => {
  const vendeurPerms = defaultRolePermissions.VENDEUR;
  assert.equal(vendeurPerms.includes("payments.create"), false, "VENDEUR must NOT have payments.create");
  assert.equal(vendeurPerms.includes("finance.view"), false, "VENDEUR must NOT have finance.view");
});

test("Sprint 4: Permission Catalog includes quotes and invoices permissions", () => {
  const keys = permissionCatalog.map((p) => p.key);
  assert.ok(keys.includes("quotes.view"));
  assert.ok(keys.includes("quotes.create"));
  assert.ok(keys.includes("quotes.convert"));
  assert.ok(keys.includes("invoices.view"));
});

test("Sprint 4: VENDEUR label is properly defined in commerceRoleLabels", () => {
  assert.equal(commerceRoleLabels.VENDEUR, "Vendeur / Commercial");
});

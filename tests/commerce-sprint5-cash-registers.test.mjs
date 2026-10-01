import assert from "node:assert/strict";
import test from "node:test";
import { defaultRolePermissions, permissionCatalog } from "../src/lib/staff-permissions.ts";
import { commerceRoleLabels } from "../src/lib/commerce-permissions.ts";

test("Sprint 5: Role CAISSIER has cash management and closing permissions", () => {
  assert.ok(defaultRolePermissions.CAISSIER, "Role CAISSIER should exist in defaultRolePermissions");
  const caissierPerms = defaultRolePermissions.CAISSIER;
  
  assert.ok(caissierPerms.includes("cash.view"), "CAISSIER must have cash.view");
  assert.ok(caissierPerms.includes("cash.manage"), "CAISSIER must have cash.manage");
  assert.ok(caissierPerms.includes("cash.close"), "CAISSIER must have cash.close");
  assert.ok(caissierPerms.includes("payments.create"), "CAISSIER must have payments.create");
  assert.ok(caissierPerms.includes("invoices.view"), "CAISSIER must have invoices.view");
});

test("Sprint 5: Strict Separation of Duties - VENDEUR cannot manage cash or payments", () => {
  const vendeurPerms = defaultRolePermissions.VENDEUR;
  assert.equal(vendeurPerms.includes("cash.manage"), false, "VENDEUR must NOT have cash.manage");
  assert.equal(vendeurPerms.includes("cash.close"), false, "VENDEUR must NOT have cash.close");
  assert.equal(vendeurPerms.includes("payments.create"), false, "VENDEUR must NOT have payments.create");
});

test("Sprint 5: Strict Separation of Duties - CAISSIER cannot create quotes or modify catalog", () => {
  const caissierPerms = defaultRolePermissions.CAISSIER;
  assert.equal(caissierPerms.includes("quotes.create"), false, "CAISSIER must NOT have quotes.create");
  assert.equal(caissierPerms.includes("products.manage"), false, "CAISSIER must NOT have products.manage");
});

test("Sprint 5: Permission Catalog includes cash.view, cash.manage, and cash.close", () => {
  const keys = permissionCatalog.map((p) => p.key);
  assert.ok(keys.includes("cash.view"));
  assert.ok(keys.includes("cash.manage"));
  assert.ok(keys.includes("cash.close"));
});

test("Sprint 5: CAISSIER label is defined in commerceRoleLabels", () => {
  assert.equal(commerceRoleLabels.CAISSIER, "Caissier");
});

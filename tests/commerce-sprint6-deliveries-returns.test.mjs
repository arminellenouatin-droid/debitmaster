import assert from "node:assert/strict";
import test from "node:test";
import { defaultRolePermissions, permissionCatalog } from "../src/lib/staff-permissions.ts";
import { commerceRoleLabels } from "../src/lib/commerce-permissions.ts";

test("Sprint 6: Role MAGASINIER has delivery and return permissions", () => {
  assert.ok(defaultRolePermissions.MAGASINIER, "Role MAGASINIER should exist in defaultRolePermissions");
  const magasinierPerms = defaultRolePermissions.MAGASINIER;

  assert.ok(magasinierPerms.includes("deliveries.view"), "MAGASINIER must have deliveries.view");
  assert.ok(magasinierPerms.includes("deliveries.confirm"), "MAGASINIER must have deliveries.confirm");
  assert.ok(magasinierPerms.includes("returns.manage"), "MAGASINIER must have returns.manage");
  assert.ok(magasinierPerms.includes("stock.view"), "MAGASINIER must have stock.view");
  assert.ok(magasinierPerms.includes("stock.issue"), "MAGASINIER must have stock.issue");
});

test("Sprint 6: Strict Separation of Duties - MAGASINIER cannot cash payments or create quotes", () => {
  const magasinierPerms = defaultRolePermissions.MAGASINIER;
  assert.equal(magasinierPerms.includes("cash.manage"), false, "MAGASINIER must NOT have cash.manage");
  assert.equal(magasinierPerms.includes("payments.create"), false, "MAGASINIER must NOT have payments.create");
  assert.equal(magasinierPerms.includes("quotes.create"), false, "MAGASINIER must NOT have quotes.create");
});

test("Sprint 6: Strict Separation of Duties - VENDEUR cannot confirm stock delivery", () => {
  const vendeurPerms = defaultRolePermissions.VENDEUR;
  assert.equal(vendeurPerms.includes("deliveries.confirm"), false, "VENDEUR must NOT have deliveries.confirm");
});

test("Sprint 6: Permission Catalog includes deliveries and returns permissions", () => {
  const keys = permissionCatalog.map((p) => p.key);
  assert.ok(keys.includes("deliveries.view"));
  assert.ok(keys.includes("deliveries.confirm"));
  assert.ok(keys.includes("returns.manage"));
});

test("Sprint 6: MAGASINIER label is defined in commerceRoleLabels", () => {
  assert.equal(commerceRoleLabels.MAGASINIER, "Magasinier");
});

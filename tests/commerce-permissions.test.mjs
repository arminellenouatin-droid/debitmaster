import assert from "node:assert/strict";
import test from "node:test";
import { commercePermissionCatalog, commercePermissionKeys, commerceRoleLabels } from "../src/lib/commerce-permissions.ts";

test("Commerce permission keys are unique and least-privilege capabilities are explicit", () => {
  const keys = commercePermissionCatalog.map(({ key }) => key);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(commercePermissionKeys.size, keys.length);
  assert.ok(commercePermissionKeys.has("costs.view"));
  assert.ok(commercePermissionKeys.has("team.manage"));
});

test("Commerce exposes only its own staff role labels", () => {
  assert.equal(commerceRoleLabels.GERANT, "Gérant / Directeur");
  assert.equal(commerceRoleLabels.VENDEUR, "Vendeur / Commercial");
  assert.equal(Object.hasOwn(commerceRoleLabels, "TENANT_STAFF"), false);
});

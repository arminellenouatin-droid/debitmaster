import assert from "node:assert/strict";
import test from "node:test";
import { createPublicMenuToken, verifyPublicMenuToken } from "../src/lib/public-menu-token.ts";

process.env.MENU_TOKEN_SECRET = "test-menu-token-secret";

test("public menu token keeps table QR compatibility", () => {
  const token = createPublicMenuToken({ tenantId: "tenant-1", tableId: "table-1" });
  assert.deepEqual(verifyPublicMenuToken(token), { tenantId: "tenant-1", tableId: "table-1" });
});

test("public menu token supports a tenant-scoped room QR", () => {
  const token = createPublicMenuToken({ tenantId: "tenant-1", roomId: "room-1" });
  assert.deepEqual(verifyPublicMenuToken(token), { tenantId: "tenant-1", roomId: "room-1" });
});

test("public menu token rejects missing or ambiguous targets", () => {
  assert.throws(() => createPublicMenuToken({ tenantId: "tenant-1" }), /MENU_TOKEN_TARGET_INVALID/);
  assert.throws(() => createPublicMenuToken({ tenantId: "tenant-1", tableId: "table-1", roomId: "room-1" }), /MENU_TOKEN_TARGET_INVALID/);
  assert.equal(verifyPublicMenuToken("v1.bad.bad"), null);
});

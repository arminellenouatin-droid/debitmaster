import assert from "node:assert/strict";
import test from "node:test";
import { detectSupportedImageMime } from "../src/lib/image-validation.ts";

test("detectSupportedImageMime trusts the file signature, not a filename or MIME claim", () => {
  assert.equal(detectSupportedImageMime(Uint8Array.from([0xff, 0xd8, 0xff, 0x00])), "image/jpeg");
  assert.equal(detectSupportedImageMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(detectSupportedImageMime(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])), "image/webp");
  assert.equal(detectSupportedImageMime(Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])), null);
  assert.equal(detectSupportedImageMime(new Uint8Array()), null);
});

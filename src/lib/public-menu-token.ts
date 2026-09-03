// Menu QR public, Design Read: expérience lounge sombre et chaleureuse pour une commande mobile, avec un jeton opaque signé et vérifié côté serveur.
import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_VERSION = "v1";

export type MenuTokenPayload = { tenantId: string; tableId?: string; roomId?: string };

function secret() {
  const value =
    process.env.MENU_TOKEN_SECRET ??
    process.env.PUBLIC_MENU_TOKEN_SECRET ??
    process.env.JWT_SECRET;
  if (!value) throw new Error("MENU_TOKEN_SECRET_MISSING");
  return value;
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signature(input: string) {
  return createHmac("sha256", secret()).update(input).digest("base64url");
}

export function createPublicMenuToken(payload: MenuTokenPayload) {
  if ((payload.tableId ? 1 : 0) + (payload.roomId ? 1 : 0) !== 1) throw new Error("MENU_TOKEN_TARGET_INVALID");
  const body = encode(JSON.stringify(payload));
  return `${TOKEN_VERSION}.${body}.${signature(`${TOKEN_VERSION}.${body}`)}`;
}

export function verifyPublicMenuToken(token: string): MenuTokenPayload | null {
  const [version, body, suppliedSignature] = token.split(".");
  if (version !== TOKEN_VERSION || !body || !suppliedSignature) return null;
  const expected = signature(`${version}.${body}`);
  const left = Buffer.from(expected);
  const right = Buffer.from(suppliedSignature);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(decode(body)) as Partial<MenuTokenPayload>;
    if (typeof payload.tenantId !== "string") return null;
    const hasTable = typeof payload.tableId === "string" && payload.tableId.length > 0;
    const hasRoom = typeof payload.roomId === "string" && payload.roomId.length > 0;
    if (Number(hasTable) + Number(hasRoom) !== 1) return null;
    return hasTable ? { tenantId: payload.tenantId, tableId: payload.tableId } : { tenantId: payload.tenantId, roomId: payload.roomId };
  } catch {
    return null;
  }
}

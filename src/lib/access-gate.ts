import { createHash } from "crypto";
import type { NextRequest } from "next/server";

export const accessCookieName = "lime_site_access";

export function isAccessGateEnabled() {
  return Boolean(process.env.SITE_ACCESS_PASSWORD?.trim());
}

export function createAccessToken(password = process.env.SITE_ACCESS_PASSWORD ?? "") {
  const value = password.trim();
  if (!value) return "";
  return createHash("sha256").update(`lime-access:${value}`).digest("hex");
}

export function hasValidAccess(request: NextRequest) {
  if (!isAccessGateEnabled()) return true;
  const token = request.cookies.get(accessCookieName)?.value ?? "";
  return token === createAccessToken();
}

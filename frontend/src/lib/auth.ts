import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function getSessionSignature(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`dq-portal-auth-salt:${password}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const checkAuth = createServerFn({ method: "GET" }).handler(async () => {
  const { getCookie } = await import("@tanstack/react-start/server");
  const session = getCookie("dq_session");
  const expectedPassword = process.env.PORTAL_PASSWORD || "admin123";
  const expectedSignature = await getSessionSignature(expectedPassword);
  const authenticated = session === expectedSignature;
  return { authenticated };
});

export const loginPortal = createServerFn({ method: "POST" })
  .validator(z.string())
  .handler(async ({ data: password }) => {
    const { setCookie } = await import("@tanstack/react-start/server");
    const expectedPassword = process.env.PORTAL_PASSWORD || "admin123";
    if (password === expectedPassword) {
      const signature = await getSessionSignature(expectedPassword);
      setCookie("dq_session", signature, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        sameSite: "lax",
      });
      return { success: true };
    }
    return { success: false, error: "Incorrect password" };
  });

export const logoutPortal = createServerFn({ method: "POST" }).handler(async () => {
  // Clear the session cookie the same way it was set (httpOnly, so it can only
  // be removed server-side). Overwriting with an immediate expiry deletes it.
  const { setCookie } = await import("@tanstack/react-start/server");
  setCookie("dq_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    sameSite: "lax",
    maxAge: 0,
  });
  return { success: true };
});

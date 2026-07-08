import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const checkAuth = createServerFn({ method: "GET" }).handler(async () => {
  const { getCookie } = await import("@tanstack/react-start/server");
  const session = getCookie("dq_session");
  const expectedPassword = process.env.PORTAL_PASSWORD || "admin123";
  const authenticated = session === expectedPassword;
  return { authenticated };
});

export const loginPortal = createServerFn({ method: "POST" })
  .validator(z.string())
  .handler(async ({ data: password }) => {
    const { setCookie } = await import("@tanstack/react-start/server");
    const expectedPassword = process.env.PORTAL_PASSWORD || "admin123";
    if (password === expectedPassword) {
      setCookie("dq_session", expectedPassword, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        sameSite: "lax",
      });
      return { success: true };
    }
    return { success: false, error: "Incorrect password" };
  });

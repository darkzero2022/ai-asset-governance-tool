import bcrypt from "bcryptjs";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "./app.js";
import { prisma } from "./prisma.js";

const email = "auth-hardening@example.com";
const password = "a-perfectly-fine-passphrase";
const FETCH = { "X-Requested-With": "fetch" };

async function resetUser() {
  await prisma.session.deleteMany({ where: { user: { email } } });
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash: await bcrypt.hash(password, 10), role: "ADMIN", active: true, failedLoginAttempts: 0, lockedUntil: null, tokenVersion: 0, mustChangePassword: false },
    create: { email, name: "Auth Hardening", role: "ADMIN", passwordHash: await bcrypt.hash(password, 10) },
  });
}

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret";
});
beforeEach(resetUser);
afterAll(async () => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await prisma.auditLog.deleteMany({ where: { actorId: user.id } });
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  await prisma.$disconnect();
});

function refreshCookie(res: request.Response): string {
  const set = res.headers["set-cookie"] as unknown as string[] | undefined;
  const cookie = set?.find((c) => c.startsWith("refresh_token="));
  return cookie ? cookie.split(";")[0] : "";
}

describe("account lockout", () => {
  it("locks after 8 failed attempts and a correct attempt before that resets the counter", async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).post("/api/v1/auth/login").send({ email, password: "wrong-password-attempt" }).expect(401);
    }
    // a success mid-streak clears the counter
    await request(app).post("/api/v1/auth/login").send({ email, password }).expect(200);
    for (let i = 0; i < 7; i++) {
      await request(app).post("/api/v1/auth/login").send({ email, password: "wrong-password-attempt" }).expect(401);
    }
    const locked = await request(app).post("/api/v1/auth/login").send({ email, password: "wrong-password-attempt" }).expect(423);
    expect(locked.body.error.code).toBe("ACCOUNT_LOCKED");
    // even the correct password is refused while locked
    await request(app).post("/api/v1/auth/login").send({ email, password }).expect(423);
  });
});

describe("refresh token rotation", () => {
  it("rotates the refresh token and invalidates the old one", async () => {
    const login = await request(app).post("/api/v1/auth/login").send({ email, password }).expect(200);
    const cookie1 = refreshCookie(login);
    expect(cookie1).toContain("refresh_token=");

    const refreshed = await request(app).post("/api/v1/auth/refresh").set(FETCH).set("Cookie", cookie1).expect(200);
    expect(refreshed.body.accessToken).toEqual(expect.any(String));
    const cookie2 = refreshCookie(refreshed);

    // the old refresh token is now dead; the new one works
    await request(app).post("/api/v1/auth/refresh").set(FETCH).set("Cookie", cookie1).expect(401);
    await request(app).post("/api/v1/auth/refresh").set(FETCH).set("Cookie", cookie2).expect(200);

    // the new access token authenticates
    await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${refreshed.body.accessToken}`).expect(200);
  });

  it("requires the X-Requested-With header", async () => {
    const login = await request(app).post("/api/v1/auth/login").send({ email, password }).expect(200);
    await request(app).post("/api/v1/auth/refresh").set("Cookie", refreshCookie(login)).expect(400);
  });
});

describe("change password", () => {
  it("enforces the policy, checks the current password, and invalidates every existing session", async () => {
    const login = await request(app).post("/api/v1/auth/login").send({ email, password }).expect(200);
    const oldAccess = login.body.accessToken;
    const oldRefresh = refreshCookie(login);

    // weak / common
    await request(app).post("/api/v1/auth/change-password").set("Authorization", `Bearer ${oldAccess}`)
      .send({ currentPassword: password, newPassword: "short" }).expect(422);
    await request(app).post("/api/v1/auth/change-password").set("Authorization", `Bearer ${oldAccess}`)
      .send({ currentPassword: password, newPassword: "welcome12345" }).expect(422);
    // wrong current
    await request(app).post("/api/v1/auth/change-password").set("Authorization", `Bearer ${oldAccess}`)
      .send({ currentPassword: "not-the-current-one", newPassword: "brand-new-solid-passphrase" }).expect(401);

    // success
    const changed = await request(app).post("/api/v1/auth/change-password").set("Authorization", `Bearer ${oldAccess}`)
      .send({ currentPassword: password, newPassword: "brand-new-solid-passphrase" }).expect(200);
    expect(changed.body.accessToken).toEqual(expect.any(String));

    // old access token is now stale, old refresh cookie is dead, new access token works
    await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${oldAccess}`).expect(401).expect((r) => {
      expect(r.body.error.code).toBe("TOKEN_STALE");
    });
    await request(app).post("/api/v1/auth/refresh").set(FETCH).set("Cookie", oldRefresh).expect(401);
    await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${changed.body.accessToken}`).expect(200);

    // and the new password logs in
    await request(app).post("/api/v1/auth/login").send({ email, password: "brand-new-solid-passphrase" }).expect(200);
  });
});

describe("sessions + logout-all", () => {
  it("lists sessions, revokes one, and 'log out of all devices' kills every token", async () => {
    const a = await request(app).post("/api/v1/auth/login").send({ email, password }).expect(200);
    const b = await request(app).post("/api/v1/auth/login").send({ email, password }).expect(200);

    const list = await request(app).get("/api/v1/auth/sessions").set("Authorization", `Bearer ${a.body.accessToken}`).set("Cookie", refreshCookie(a)).expect(200);
    expect(list.body.sessions.length).toBe(2);
    expect(list.body.sessions.filter((s: { current: boolean }) => s.current).length).toBe(1);

    const other = list.body.sessions.find((s: { current: boolean }) => !s.current);
    await request(app).delete(`/api/v1/auth/sessions/${other.id}`).set("Authorization", `Bearer ${a.body.accessToken}`).set("Cookie", refreshCookie(a)).expect(204);
    await request(app).post("/api/v1/auth/refresh").set(FETCH).set("Cookie", refreshCookie(b)).expect(401);

    await request(app).post("/api/v1/auth/logout-all").set("Authorization", `Bearer ${a.body.accessToken}`).expect(204);
    await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${a.body.accessToken}`).expect(401);
    await request(app).post("/api/v1/auth/refresh").set(FETCH).set("Cookie", refreshCookie(a)).expect(401);
  });
});

import bcrypt from "bcryptjs";
import request from "supertest";
import { authenticator } from "otplib";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "./app.js";
import { prisma } from "./prisma.js";

const email = "totp-test@example.com";
const password = "a-perfectly-fine-passphrase";
const FETCH = { "X-Requested-With": "fetch" };

async function resetUser() {
  await prisma.totpRecoveryCode.deleteMany({ where: { user: { email } } });
  await prisma.session.deleteMany({ where: { user: { email } } });
  await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash: await bcrypt.hash(password, 10),
      role: "ADMIN",
      active: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      totpSecret: null,
      totpEnabledAt: null,
    },
    create: {
      email,
      name: "TOTP Test",
      role: "ADMIN",
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
}

function login(body: Record<string, unknown>) {
  return request(app)
    .post("/api/v1/auth/login")
    .set(FETCH)
    .send({ email, password, ...body });
}

beforeAll(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret";
});
beforeEach(resetUser);
afterAll(async () => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await prisma.auditLog.deleteMany({ where: { actorId: user.id } });
    await prisma.totpRecoveryCode.deleteMany({ where: { userId: user.id } });
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  await prisma.$disconnect();
});

describe("TOTP enrolment + login step-up", () => {
  it("enrols, then demands a code at login", async () => {
    const first = await login({});
    const token = first.body.accessToken as string;
    const auth = { Authorization: `Bearer ${token}` };

    // setup -> secret + QR
    const setup = await request(app).post("/api/v1/auth/totp/setup").set(auth).expect(200);
    expect(setup.body.secret).toEqual(expect.any(String));
    expect(setup.body.qrDataUri).toMatch(/^data:image\/png;base64,/);
    const secret = setup.body.secret as string;

    // wrong code is rejected
    await request(app)
      .post("/api/v1/auth/totp/enable")
      .set(auth)
      .send({ code: "000000" })
      .expect(401);

    // correct code enables + returns recovery codes
    const enable = await request(app)
      .post("/api/v1/auth/totp/enable")
      .set(auth)
      .send({ code: authenticator.generate(secret) })
      .expect(200);
    expect(enable.body.recoveryCodes).toHaveLength(10);
    const recoveryCode = enable.body.recoveryCodes[0] as string;

    // password alone now returns mfaRequired, no tokens
    const stepOne = await login({}).expect(200);
    expect(stepOne.body).toEqual({ mfaRequired: true });
    expect(stepOne.body.accessToken).toBeUndefined();

    // password + a valid TOTP completes the login
    const ok = await login({ totpCode: authenticator.generate(secret) }).expect(200);
    expect(ok.body.accessToken).toEqual(expect.any(String));

    // a recovery code also works, and is single-use
    await login({ totpCode: recoveryCode }).expect(200);
    await login({ totpCode: recoveryCode }).expect(401);
  });

  it("a bad second factor counts toward the lockout", async () => {
    const first = await login({});
    const auth = { Authorization: `Bearer ${first.body.accessToken}` };
    const setup = await request(app).post("/api/v1/auth/totp/setup").set(auth);
    await request(app)
      .post("/api/v1/auth/totp/enable")
      .set(auth)
      .send({ code: authenticator.generate(setup.body.secret) })
      .expect(200);

    for (let i = 0; i < 7; i++) await login({ totpCode: "111111" }).expect(401);
    await login({ totpCode: "111111" }).expect(423); // 8th trips the lock
  });

  it("disable requires the password and clears recovery codes", async () => {
    const first = await login({});
    const auth = { Authorization: `Bearer ${first.body.accessToken}` };
    const setup = await request(app).post("/api/v1/auth/totp/setup").set(auth);
    await request(app)
      .post("/api/v1/auth/totp/enable")
      .set(auth)
      .send({ code: authenticator.generate(setup.body.secret) });

    await request(app)
      .post("/api/v1/auth/totp/disable")
      .set(auth)
      .send({ password: "wrong" })
      .expect(401);
    await request(app).post("/api/v1/auth/totp/disable").set(auth).send({ password }).expect(200);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.totpEnabledAt).toBeNull();
    expect(await prisma.totpRecoveryCode.count({ where: { userId: user.id } })).toBe(0);

    // login no longer needs a code
    const ok = await login({}).expect(200);
    expect(ok.body.accessToken).toEqual(expect.any(String));
  });
});

import bcrypt from "bcryptjs";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "./app.js";
import { prisma } from "./prisma.js";

const email = "auth-test@example.com";
const password = "correct-password";

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret";
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash: await bcrypt.hash(password, 10), role: "ADMIN" },
    create: {
      email,
      name: "Auth Test User",
      role: "ADMIN",
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

describe("POST /auth/login", () => {
  it("returns a token for valid credentials", async () => {
    const response = await request(app).post("/api/v1/auth/login").send({ email, password }).expect(200);

    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user).toMatchObject({ email, role: "ADMIN" });
  });

  it("rejects invalid credentials", async () => {
    await request(app).post("/api/v1/auth/login").send({ email, password: "wrong-password" }).expect(401);
  });
});

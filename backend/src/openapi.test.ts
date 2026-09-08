import SwaggerParser from "@apidevtools/swagger-parser";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "./app.js";

describe("OpenAPI document", () => {
  it("is served at /api/docs/openapi.json and validates as OpenAPI 3.0", async () => {
    const response = await request(app).get("/api/docs/openapi.json").expect(200);

    const document = await SwaggerParser.validate(structuredClone(response.body));
    expect(document.openapi).toBe("3.0.3");

    // The path list is generated from the mounted routers — every real domain
    // route should show up, and none of it should be prefixed by /api/v1
    // again (the document's `servers` entry already carries that prefix).
    expect(Object.keys(document.paths ?? {}).length).toBeGreaterThan(40);
    expect(document.paths?.["/ai-systems"]?.get).toBeTruthy();
    expect(document.paths?.["/ai-systems"]?.post?.requestBody).toBeTruthy();
    expect(Object.keys(document.paths ?? {}).some((p) => p.startsWith("/api/v1"))).toBe(false);
  });

  it("serves Swagger UI at /api/docs", async () => {
    const response = await request(app).get("/api/docs/").expect(200);
    expect(response.text).toContain("swagger-ui");
  });
});

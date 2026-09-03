import "./env.js";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required");
}

const port = Number(process.env.PORT ?? 4000);
const { app } = await import("./app.js");
const { shouldServeStatic } = await import("./staticSite.js");

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  if (shouldServeStatic()) {
    console.log(`Web app served on http://localhost:${port}`);
  }
});

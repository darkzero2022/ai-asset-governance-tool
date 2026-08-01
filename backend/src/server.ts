import "dotenv/config";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required");
}

const port = Number(process.env.PORT ?? 4000);
const { app } = await import("./app.js");

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

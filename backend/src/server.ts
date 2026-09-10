import "./env.js";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required");
}

const port = Number(process.env.PORT ?? 4000);
const { app } = await import("./app.js");
const { shouldServeStatic } = await import("./middleware/staticSite.js");
const { logger } = await import("./log.js");
const { startScheduler } = await import("./lib/scheduler.js");

app.listen(port, () => {
  logger.info({ port, serveStatic: shouldServeStatic() }, `listening on http://localhost:${port}`);
  startScheduler();
});

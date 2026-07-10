import express from "express";
import cors from "cors";
import pinoHttpNamespace from "pino-http";
import path from "path";
import router from "./routes/index.js";
import { fileURLToPath } from "url";
import { logger } from "./lib/logger.js";
import jsonDb from "./lib/jsonDb.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pinoHttp = (pinoHttpNamespace as any).default || pinoHttpNamespace;

const app = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: any) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: any) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure DB is initialized before executing any API request
app.use(async (req: any, res: any, next: any) => {
  try {
    await jsonDb.init();
  } catch (err) {
    console.error("[SMGrade App] Failed to initialize database on request:", err);
  }
  next();
});

// Unify static file hosting for React client build folder
import fs from "fs";
let publicPath = path.resolve(__dirname, "../../dist/public");
if (!fs.existsSync(path.join(publicPath, "index.html"))) {
  publicPath = path.resolve(__dirname, "../../smgrade/dist/public");
}
app.use(express.static(publicPath));

app.use("/api", router);

app.get("*any", (req: any, res: any) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(publicPath, "index.html"), (err: any) => {
      if (err) {
        res.status(404).send("Front-end asset folder not built. Run pnpm run build first.");
      }
    });
  }
});

export default app;

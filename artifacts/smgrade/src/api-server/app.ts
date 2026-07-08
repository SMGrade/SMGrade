import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
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

// Unify static file hosting for React client build folder
import fs from "fs";
let publicPath = path.resolve(__dirname, "../../dist/public");
if (!fs.existsSync(path.join(publicPath, "index.html"))) {
  publicPath = path.resolve(__dirname, "../../smgrade/dist/public");
}
app.use(express.static(publicPath));

app.use("/api", router);

app.get("*any", (req, res) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(publicPath, "index.html"), (err) => {
      if (err) {
        res.status(404).send("Front-end asset folder not built. Run pnpm run build first.");
      }
    });
  }
});

export default app;

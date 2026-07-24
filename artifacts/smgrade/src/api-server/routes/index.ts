import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import gradeRouter from "./grade.js";
import authRouter from "./auth.js";
import masterRouter from "./master.js";
import liveLookupRouter from "./liveLookup.js";

const router = Router();

router.use(healthRouter);
router.use(gradeRouter);
router.use("/auth", authRouter);
router.use(masterRouter);
router.use("/master", masterRouter);
router.use(liveLookupRouter);

export default router;

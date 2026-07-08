import { Router, type IRouter } from "express";
import healthRouter from "./health";
import gradeRouter from "./grade";
import authRouter from "./auth";
import masterRouter from "./master";
import liveLookupRouter from "./liveLookup";

const router: IRouter = Router();

router.use(healthRouter);
router.use(gradeRouter);
router.use("/auth", authRouter);
router.use("/master", masterRouter);
router.use(liveLookupRouter);

export default router;

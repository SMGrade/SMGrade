import { Router, type IRouter } from "express";
import healthRouter from "./health";
import gradeRouter from "./grade";

const router: IRouter = Router();

router.use(healthRouter);
router.use(gradeRouter);

export default router;

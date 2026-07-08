import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import applicationsRouter from "./applications";
import infrastructureRouter from "./infrastructure";
import databasesRouter from "./databases";
import domainsRouter from "./domains";
import repositoriesRouter from "./repositories";
import releasesRouter from "./releases";
import securityRouter from "./security";
import softwareRouter from "./software";
import documentationRouter from "./documentation";
import reportsRouter from "./reports";
import adminRouter from "./admin";
import searchRouter from "./search";
import storageRouter from "./storage";
import teamsRouter from "./teams";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/dashboard", dashboardRouter);
router.use("/applications", applicationsRouter);
router.use("/infrastructure", infrastructureRouter);
router.use("/databases", databasesRouter);
router.use("/domains", domainsRouter);
router.use("/repositories", repositoriesRouter);
router.use("/releases", releasesRouter);
router.use("/security", securityRouter);
router.use("/software", softwareRouter);
router.use("/documentation", documentationRouter);
router.use("/reports", reportsRouter);
router.use("/admin", adminRouter);
router.use("/search", searchRouter);
router.use("/teams", teamsRouter);
router.use(storageRouter);

export default router;

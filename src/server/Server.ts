import cluster from "node:cluster";
import { startMaster } from "./Master.js";
import { startWorker } from "./Worker.js";

if (cluster.isPrimary) {
  startMaster();
} else {
  startWorker();
}

import cluster, { type Worker } from "node:cluster";
import http from "node:http";
import os from "node:os";
import { MasterLobbyService } from "./MasterLobbyService.js";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "changeme";
const PORT = parseInt(process.env.PORT ?? "3000", 10);
const NUM_WORKERS = parseInt(
  process.env.NUM_WORKERS ?? String(Math.max(1, os.cpus().length - 1)),
  10,
);

export interface WorkerInfo {
  id: number;
  worker: Worker;
  port: number;
  ready: boolean;
  gameCount: number;
}

export function startMaster(): void {
  const workers = new Map<number, WorkerInfo>();
  const lobbyService = new MasterLobbyService(workers);

  console.log(`[Master] Starting ${NUM_WORKERS} workers on port ${PORT}`);

  for (let i = 0; i < NUM_WORKERS; i++) {
    forkWorker(workers, i, lobbyService);
  }

  // Restart crashed workers
  cluster.on("exit", (deadWorker, code, signal) => {
    const info = [...workers.entries()].find(
      ([, w]) => w.worker === deadWorker,
    );
    if (info) {
      const [id, wInfo] = info;
      console.log(
        `[Master] Worker ${id} died (code=${code}, signal=${signal}). Restarting...`,
      );
      workers.delete(id);
      forkWorker(workers, wInfo.id, lobbyService);
    }
  });

  // HTTP server for /health and admin
  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      const readyCount = [...workers.values()].filter((w) => w.ready).length;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          workers: workers.size,
          ready: readyCount,
          uptime: process.uptime(),
        }),
      );
      return;
    }

    if (req.url === "/api/health") {
      const readyCount = [...workers.values()].filter((w) => w.ready).length;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: readyCount > 0 ? "healthy" : "degraded",
          workers: workers.size,
          ready: readyCount,
          uptime: process.uptime(),
        }),
      );
      return;
    }

    if (req.url === "/api/instance") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          gitCommit: process.env.GIT_COMMIT ?? "dev",
          nodeVersion: process.version,
          platform: process.platform,
          pid: process.pid,
          uptime: process.uptime(),
        }),
      );
      return;
    }

    if (req.url === "/admin/workers") {
      const auth = req.headers.authorization;
      if (auth !== `Bearer ${ADMIN_TOKEN}`) {
        res.writeHead(401);
        res.end("Unauthorized");
        return;
      }
      const data = [...workers.values()].map((w) => ({
        id: w.id,
        port: w.port,
        ready: w.ready,
        gameCount: w.gameCount,
      }));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
      return;
    }

    res.writeHead(404);
    res.end("Not Found");
  });

  server.listen(PORT, () => {
    console.log(`[Master] Health server listening on :${PORT}`);
  });

  lobbyService.start();
}

function forkWorker(
  workers: Map<number, WorkerInfo>,
  id: number,
  lobbyService: MasterLobbyService,
): void {
  const port = 4000 + id;
  const worker = cluster.fork({ WORKER_ID: String(id), WORKER_PORT: String(port) });

  const info: WorkerInfo = {
    id,
    worker,
    port,
    ready: false,
    gameCount: 0,
  };

  workers.set(id, info);

  worker.on("message", (msg: { type: string; [key: string]: unknown }) => {
    if (msg.type === "WorkerReady") {
      info.ready = true;
      console.log(`[Master] Worker ${id} ready on port ${port}`);
    }
    lobbyService.handleWorkerMessage(id, msg);
  });
}

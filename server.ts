import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configure parsing to handle both standard raw text logs or structured JSON
  app.use(express.json());
  app.use(express.text({ type: "*/*", limit: "5mb" }));

  // Keep track of the latest data point in-memory
  let latestData: any = null;
  const clients: any[] = [];

  // Receive WiFi data from the wearable ESP32
  app.post("/api/wearable", (req, res) => {
    const body = req.body;
    let dataString = "";

    if (typeof body === "string") {
      dataString = body;
    } else if (typeof body === "object") {
      dataString = JSON.stringify(body);
    }

    if (dataString) {
      latestData = dataString;
      // Instant broadcast to all open browser windows via Server-Sent Events (SSE)
      clients.forEach((client) => {
        client.write(`data: ${dataString}\n\n`);
      });
    }

    res.json({ status: "success", received: true });
  });

  // REST API Route to retrieve the latest state
  app.get("/api/wearable", (req, res) => {
    res.json({ latest: latestData });
  });

  // Server-Sent Events stream for instant real-time browser updates
  app.get("/api/wearable-stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    clients.push(res);

    // Send a secure initial keep-alive ping
    res.write("data: {\"type\":\"keepalive\"}\n\n");

    // Manage disconnected clients
    req.on("close", () => {
      const idx = clients.indexOf(res);
      if (idx !== -1) {
        clients.splice(idx, 1);
      }
    });
  });

  // Integración de Vite Middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[ESP32 Server] Running and listening on http://0.0.0.0:${PORT}`);
    console.log(`[ESP32 endpoint] Post data directly to http://<IP-OF-THIS-SERVICE>:${PORT}/api/wearable`);
  });
}

startServer();

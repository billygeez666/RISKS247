import http from "node:http"; import fs from "node:fs"; import { handle } from "../netlify/functions/order.mjs";
http.createServer(async (q, s) => {
  if (q.url === "/api/order") { let b = ""; for await (const c of q) b += c;
    const r = await handle(new Request("http://x/api/order", { method: q.method, headers: q.headers, body: q.method === "POST" ? b : undefined }), { ORDERS_MODE: "test", ORDER_SECRET: "dev" });
    s.writeHead(r.status, { "content-type": "application/json" }); return s.end(await r.text()); }
  s.writeHead(200, { "content-type": "text/html; charset=utf-8" }); s.end(fs.readFileSync("public/index.html"));
}).listen(8099);

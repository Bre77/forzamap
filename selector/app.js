// Static landing page for forza.ba.id.au that links to the FH5 and FH6 maps.
// No dependencies, so it needs no install step.
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 8080;
const page = fs.readFileSync(path.join(__dirname, "public", "index.htm"));

http
  .createServer((req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405).end();
      return;
    }
    if (req.url !== "/" && !req.url.startsWith("/?")) {
      res.writeHead(302, { Location: "/" }).end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    });
    res.end(req.method === "HEAD" ? undefined : page);
  })
  .listen(PORT, () => console.log(`selector listening on ${PORT}`));

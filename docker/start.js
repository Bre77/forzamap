// Runs both Forza map servers in one container. If either exits, stop the
// other and exit so Docker's restart policy brings the container back.
// Set APPS to a subset (e.g. APPS=fh6) to run only some of them.
const { spawn } = require("child_process");
const readline = require("readline");

const apps = (process.env.APPS || "fh6,fh5,selector").split(",").map((a) => a.trim());
const children = [];
let stopping = false;

function shutdown(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 2000).unref();
}

for (const name of apps) {
  const child = spawn(process.execPath, [`${__dirname}/${name}/app.js`], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  // Prefix each log line with the app name
  readline.createInterface({ input: child.stdout }).on("line", (l) => console.log(`[${name}] ${l}`));
  readline.createInterface({ input: child.stderr }).on("line", (l) => console.error(`[${name}] ${l}`));
  child.on("exit", (code, signal) => {
    console.error(`[${name}] exited (${signal || code})`);
    shutdown(stopping ? 0 : 1);
  });
  children.push(child);
}

process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));

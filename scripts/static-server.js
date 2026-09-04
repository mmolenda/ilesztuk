import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

http.createServer(async (request, response) => {
  let pathname = "/";
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    pathname = url.pathname;
    if (pathname === "/calculators" || pathname === "/calculators/") {
      return sendNotFound(response);
    }

    const filePath = routeToFile(pathname);
    const content = await readFile(filePath);
    const extension = path.extname(filePath);
    response.writeHead(200, { "content-type": contentTypes[extension] ?? "application/octet-stream" });
    response.end(content);
  } catch (error) {
    if (error.code === "ENOENT" && !path.extname(pathname) && !pathname.startsWith("/calculators/")) {
      const content = await readFile(path.join(publicDir, "index.html"));
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(content);
      return;
    }
    if (error.code === "ENOENT" || error.code === "EISDIR") {
      return sendNotFound(response);
    }
    console.error(error);
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end("Internal server error");
  }
}).listen(port, host, () => {
  console.log(`IleSztuk static server listening on http://${host}:${port}`);
});

function routeToFile(pathname) {
  if (pathname === "/") {
    return path.join(publicDir, "index.html");
  }

  const filePath = path.normalize(path.join(publicDir, pathname));
  if (!filePath.startsWith(publicDir)) {
    return path.join(publicDir, "index.html");
  }

  if (path.extname(filePath)) {
    return filePath;
  }
  return path.join(publicDir, "index.html");
}

function sendNotFound(response) {
  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  response.end("Not found");
}

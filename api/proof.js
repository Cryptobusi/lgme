const fs = require("fs");
const path = require("path");

const PASS = "thirdseat01e";
const TOKEN = "lgme-first-3s01e";
const FILE = path.join(process.cwd(), "private", "ididit-proof.jpg");

function cookieOk(req) {
  const raw = req.headers.cookie || "";
  return raw.split(";").some((part) => part.trim() === "lgme_first=" + TOKEN);
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string") {
    try {
      return Promise.resolve(JSON.parse(req.body));
    } catch (e) {
      return Promise.resolve({});
    }
  }
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (e) {
        resolve({});
      }
    });
  });
}

module.exports = async (req, res) => {
  if (req.method === "POST") {
    const body = await readBody(req);
    const password = String(body.password || "").trim().toLowerCase();
    if (password !== PASS) {
      res.statusCode = 401;
      res.setHeader("content-type", "application/json");
      res.setHeader("cache-control", "no-store");
      res.end(JSON.stringify({ ok: false }));
      return;
    }
    res.setHeader(
      "set-cookie",
      "lgme_first=" + TOKEN + "; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=43200",
    );
    res.setHeader("content-type", "application/json");
    res.setHeader("cache-control", "no-store");
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.end("Method not allowed");
    return;
  }

  if (!cookieOk(req)) {
    res.statusCode = 401;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.end("Password required");
    return;
  }

  const file = fs.readFileSync(FILE);
  const download = String(req.url || "").includes("download=1");
  res.statusCode = 200;
  res.setHeader("content-type", "image/jpeg");
  res.setHeader("cache-control", "private, no-store");
  res.setHeader(
    "content-disposition",
    download ? 'attachment; filename="ididit-proof.jpg"' : "inline",
  );
  if (req.method === "HEAD") {
    res.setHeader("content-length", String(file.length));
    res.end();
    return;
  }
  res.end(file);
};

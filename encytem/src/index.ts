import { spawn } from "child_process";
import { createHmac } from "crypto";
import * as fs from "fs/promises";
import { createServer, ServerResponse } from "http";

const envFile = Object.fromEntries(
  (await fs.readFile(".env", { encoding: "utf-8" }))
    .split("\n")
    .map((e) => e.split("=", 2).map((e) => e.trim()))
);

const MASTER_BRANCH_NAME = envFile.MASTER || "master";
const GITHUB_SECRET = envFile.GITHUB_SECRET || "";
const REPO_URL = envFile.REPO_URL || "https://github.com/JakubekWeg/wonder";

if (!GITHUB_SECRET) console.error("Missing github secret!");

const runProcess = (command: string[], cwd?: string): Promise<void> => {
  const stdio =
    command[0] === "dockerd" ? "ignore" : ("ignore" as "inherit" | "ignore");
  const [cmd, ...args] = command;
  const process = spawn(cmd, args, { cwd, stdio });
  return new Promise((resolve, reject) => {
    process.once("exit", (code) => (code === 0 ? resolve() : reject()));
  });
};

runProcess(["dockerd"]).catch((e) => void e);

let working = false;
const causeUpdate = async () => {
  if (working) {
    console.warn("Already working");
    return;
  }
  try {
    working = true;
    console.log("Starting update!");
    await runProcess(["rm", "-rf", "wonder"]).catch((e) => void e);
    await runProcess([
      "git",
      "clone",
      REPO_URL,
      "--depth",
      "1",
      "--branch",
      MASTER_BRANCH_NAME,
      "wonder",
    ]);

    await runProcess(
      ["docker", "build", "-t", "foo", ".", "-f", "compiler.Dockerfile"],
      "wonder/barbet"
    );
    await runProcess(
      [
        "docker",
        "run",
        "-v",
        "/app/wonder/seampan:/app/seampan:rw",
        "-v",
        "/app/wonder/barbet/src:/app/barbet/src:rw",
        "-v",
        `${process.cwd()}/dist:/output:rw`,
        "--rm",
        "--network",
        "none",
        "-e",
        "DEV=false",
        "foo",
      ],
      "wonder/barbet"
    );

    for (const object of await fs.readdir("./dist")) {
      await fs.cp("./dist/" + object, "/output/" + object, {
        recursive: true,
        force: true,
      });
    }
    console.log("Update finished successfully");
  } finally {
    working = false;
  }
};

const computeHash = (content: Buffer): string => {
  return createHmac("sha256", GITHUB_SECRET).update(content).digest("hex");
};

const handle = (
  res: ServerResponse,
  githubSignature: string | undefined,
  githubAction: string | undefined,
  body: Buffer
) => {
  if (!githubAction) return res.writeHead(400).end();
  if (!githubSignature) return res.writeHead(401).end();

  const computedHash = computeHash(body);

  if (githubSignature.substring("sha256=".length) !== computedHash)
    return res.writeHead(403).end();

  if (githubAction === "ping") return res.writeHead(200).end();
  if (githubAction !== "push") return res.writeHead(405).end();

  const bodyParsed = JSON.parse(new TextDecoder().decode(body));
  const expectedRef = `refs/heads/${MASTER_BRANCH_NAME}`;
  if (bodyParsed.ref !== expectedRef)
    return res.writeHead(200).end("Ignoring this ref");

  causeUpdate();

  return res.writeHead(202).end();
};

runProcess(["dockerd"]).catch(() =>
  console.error("Failed to launch docker, probably already running")
);

createServer((req, res) => {
  let postData: Buffer[] = [];
  req.on("data", (chunk) => {
    if (!Buffer.isBuffer(chunk)) return;

    postData.push(chunk);
  });
  req.on("end", () => {
    try {
      const totalSize = postData.reduce((a, c) => a + c.length, 0);
      if (totalSize > 16 * 1024 * 1024) {
        // 16MB
        res.writeHead(400).end();
        console.error("Too big buffer");
      }

      const totalBuffer = Buffer.allocUnsafe(totalSize);
      let index = 0;
      for (const buffer of postData) {
        buffer.copy(totalBuffer, index);
        index += buffer.byteLength;
      }

      const githubSignature = req.headers["x-hub-signature-256"];
      const event = req.headers["x-github-event"];
      handle(
        res,
        Array.isArray(githubSignature) ? githubSignature[0] : githubSignature,
        Array.isArray(event) ? event[0] : event,
        totalBuffer
      );
    } catch (e) {
      console.error("Failed to process request", e);
      try {
        res.writeHead(500).end();
      } catch (e) {
        // ignore
      }
    }
  });
}).listen(process.env.PORT || 3000, undefined, () => {
  console.log("Webhook is ready, requesting initial build");
  causeUpdate();
});

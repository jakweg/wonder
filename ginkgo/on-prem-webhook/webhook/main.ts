import { exec, spawn } from "child_process";
import { readFileSync } from "fs";
import { createServer, ServerResponse } from "http";

const envFile = Object.fromEntries(
  readFileSync(".env", { encoding: "utf-8" })
    .split("\n")
    .map((e) => e.split("=", 2).map((e) => e.trim()))
);

const MASTER_BRANCH_NAME = envFile.MASTER || "master";
const GITHUB_SECRET = envFile.GITHUB_SECRET || "";

if (!GITHUB_SECRET) console.error("Missing github secret!");
console.log({ GITHUB_KEY: GITHUB_SECRET });

const causeUpdate = () => {
  console.log("Trggered update!");
};

async function computeHash(content: Buffer): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const process = exec(
      `openssl sha256 -hmac ${GITHUB_SECRET}`,
      (err, output) => {
        if (err) reject(err);
        else resolve(output);
      }
    );
    process.stdin.write(content);
  });
}
const handle = async (
  res: ServerResponse,
  githubSignature: string | undefined,
  githubAction: string | undefined,
  body: Buffer
) => {
  if (!githubAction) return res.writeHead(400).end();
  if (!githubSignature) return res.writeHead(401).end();

  const computedHash = await computeHash(body);
  if (githubSignature !== computedHash) return res.writeHead(403).end();

  if (githubAction === "ping") return res.writeHead(200).end();
  if (githubAction !== "push") return res.writeHead(405).end();

  const bodyParsed = JSON.parse(new TextDecoder().decode(body));
  const expectedRef = `refs/heads/${MASTER_BRANCH_NAME}`;
  if (bodyParsed.ref !== expectedRef)
    return res.writeHead(200).end("Ignoring this ref");

  causeUpdate();

  return res.writeHead(201).end("Ignoring this ref");
};

spawn("dockerd", { stdio: "ignore" });

const port = process.env.PORT || 3000;
createServer((req, res) => {
  let postData: Buffer[] = [];
  req.on("data", (chunk) => {
    if (!Buffer.isBuffer(chunk)) return;

    postData.push(chunk);
  });
  req.on("end", async () => {
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
      await handle(
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
}).listen(port, undefined, () => {
  console.log("Listening at port " + port);
});

// import { serve } from 'https://deno.land/std@0.119.0/http/server.ts';
// import 'https://deno.land/x/dotenv/mod.ts';

// const MASTER_BRANCH_NAME = 'master'
// const GITHUB_SECRET = new TextDecoder().decode(await Deno.readFile('github-secret.txt'))

// async function causeUpdate() {
// 	console.info('Requested update, launching compilation');

// }

// async function handler(request: Request): Promise<Response> {
// 	try {
// 		const bodyBuffer = await request.arrayBuffer()
// 		const hash = await computeHash(GITHUB_SECRET, new Uint8Array(bodyBuffer))
// 		const signatureFromGithub = request.headers.get('X-Hub-Signature-256')?.substring(7)
// 		if (hash !== signatureFromGithub)
// 			return new Response('Invalid hash', { status: 403 })

// 		const action = request.headers.get('X-GitHub-Event')

// 		if (action === 'ping')
// 			return new Response(null, { status: 204 })

// 		if (action !== 'push')
// 			return new Response('Invalid action', { status: 400 })

// 		const body = JSON.parse(new TextDecoder().decode(new Uint8Array(bodyBuffer)))
// 		const expectedRef = `refs/heads/${MASTER_BRANCH_NAME}`
// 		if (body.ref !== expectedRef)
// 			return new Response(`Ignoring: ref is ${body.ref}, but expected ${expectedRef}`, { status: 200 })

// 		causeUpdate()

// 		return new Response(null, { status: 201 })
// 	} catch (e) {
// 		console.error(e)
// 		return new Response(null, { status: 500 })
// 	}
// }

// const PORT = +(Deno.env.get('PORT') ?? '3000') || 3000
// serve(handler, {
// 	port: PORT,
// })

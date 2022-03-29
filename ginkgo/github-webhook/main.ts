import { serve } from 'https://deno.land/std@0.119.0/http/server.ts'
import 'https://deno.land/x/dotenv/mod.ts'

const MASTER_BRANCH_NAME = 'master'
const GITHUB_SECRET = new TextDecoder().decode(await Deno.readFile('github-secret.txt'))

async function computeHash(key: string, content: Uint8Array): Promise<string> {
	const cmd = ['openssl', 'sha256', '-hmac', key]

	const process = Deno.run({cmd, stdout: 'piped', stdin: 'piped'})

	await process.stdin.write(content)
	await process.stdin.close()
	const output = await process.output()
	const outputString = new TextDecoder().decode(output)

	if (!(await process.status()).success)
		throw new Error('openssl process failed')

	return outputString.substring(outputString.lastIndexOf(' ') + 1).trimRight()
}


async function getProjectId() {
	return await (await fetch('http://metadata.google.internal/computeMetadata/v1/project/project-id', {
		headers: {'Metadata-Flavor': 'Google'},
	})).text()
}

async function getAccessToken(): Promise<string> {
	return (await (await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', {
		headers: {'Metadata-Flavor': 'Google'},
	})).json()).access_token
}

async function sendPubSub() {
	const projectId = await getProjectId()
	const token = await getAccessToken()

	const response2 = await fetch(`https://pubsub.googleapis.com/v1/projects/${projectId}/topics/hosting-update:publish`, {
		method: 'POST',
		headers: {
			'Authorization': 'Bearer ' + token,
		},
		body: JSON.stringify({
			'messages': [
				{data: btoa('Hello world')},
			],
		}),
	})
	if (!response2.ok) {
		console.error(await response2.text())
		throw new Error('Sending pubsub failed')
	}
}

async function handler(request: Request): Promise<Response> {
	try {
		const bodyBuffer = await request.arrayBuffer()
		const hash = await computeHash(GITHUB_SECRET, new Uint8Array(bodyBuffer))
		const signatureFromGithub = request.headers.get('X-Hub-Signature-256')?.substring(7)
		if (hash !== signatureFromGithub)
			return new Response('Invalid hash', {status: 403})

		const action = request.headers.get('X-GitHub-Event')

		if (action === 'ping')
			return new Response(null, {status: 204})

		if (action !== 'push')
			return new Response('Invalid action', {status: 400})

		const body = JSON.parse(new TextDecoder().decode(new Uint8Array(bodyBuffer)))
		const expectedRef = `refs/heads/${MASTER_BRANCH_NAME}`
		if (body.ref !== expectedRef)
			return new Response(`Ignoring: ref is ${body.ref}, but expected ${expectedRef}`, {status: 200})

		await sendPubSub()

		return new Response(null, {status: 201})
	} catch (e) {
		console.error(e)
		return new Response(null, {status: 500})
	}
}

const PORT = +(Deno.env.get('PORT') ?? '3000') || 3000
serve(handler, {
	port: PORT,
})


import { serve } from 'https://deno.land/std@0.119.0/http/server.ts'
import 'https://deno.land/x/dotenv/mod.ts'

const TMP_FOLDER_ROOT = '/tmp/builder'
const FINAL_FILES_FOLDER_NAME = 'dest'
const FOLDER_TO_CLONE = 'wonder'
const BRANCH = 'master'
const GIT_URL = 'https://github.com/JakubekWeg/wonder'
const SITE_ID = 'next-wonder'

const hostedFiles = [
	'index.html',
	'404.html',
	'style.css',
	'build-js/main.js',
	'build-js/render-worker.js',
	'build-js/update-worker.js',
	'build-js/network-worker.js',
	'build-js/render-helper-worker.js',
	'build-js/feature-environments/zero.js',
	'build-js/feature-environments/first.js',
	'build-js/feature-environments/second.js',
]

async function cleanTmpFolder() {
	try {
		await Deno.remove(`${TMP_FOLDER_ROOT}`, { recursive: true })
	} catch (_) {
		// ignore
	}
}

async function createTmpFolder() {
	await Deno.mkdir(TMP_FOLDER_ROOT)
}


async function cloneRepo() {
	const cmd = ['git', 'clone', '--depth', '1', '--branch', BRANCH, GIT_URL, FOLDER_TO_CLONE]
	const process = Deno.run({ cmd, stdout: 'null', cwd: TMP_FOLDER_ROOT })
	if (!(await process.status()).success) {
		throw new Error('Git clone process failed :(')
	}
}


async function buildFrontend() {
	const cmd = ['deno', 'run', '-A', 'build.ts', '--prod']
	const process = Deno.run({ cmd, stdout: 'null', cwd: `${TMP_FOLDER_ROOT}/${FOLDER_TO_CLONE}/barbet` })
	if (!(await process.status()).success) {
		throw new Error('Build process failed :(')
	}
}

async function activateServiceAccount() {
	const cmd = ['./google-cloud-sdk/bin/gcloud', 'auth', 'activate-service-account', '--key-file', './private-key.json']
	const process = Deno.run({ cmd, stdout: 'null' })
	if (!(await process.status()).success)
		throw new Error('gcloud auth activate-service-account process failed :(')
}

async function getAccessToken(): Promise<string> {
	const cmd = ['./google-cloud-sdk/bin/gcloud', 'auth', 'print-access-token']
	const process = Deno.run({ cmd, stdout: 'piped' })

	const output = await process.output()
	const outputString = new TextDecoder().decode(output)
	if (!(await process.status()).success)
		throw new Error('gcloud auth print-access-token process failed :(')
	return outputString
}

async function createNewSite(token: string, config: string): Promise<string> {
	const response = await fetch(`https://firebasehosting.googleapis.com/v1beta1/sites/${SITE_ID}/versions`, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: config,
	})

	if (!response.ok)
		throw new Error(`Response status is ${response.status}`)
	return (await response.json()).name.split('/').slice(-1)[0]
}

async function populateFiles(token: string, versionId: string, files: any): Promise<any> {
	const response = await fetch(`https://firebasehosting.googleapis.com/v1beta1/sites/${SITE_ID}/versions/${versionId}:populateFiles`, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ files }),
	})

	if (!response.ok)
		throw new Error(`Response status is ${response.status}`)
	return await response.json()
}

async function uploadFile(token: string, url: string, hash: string, filePath: string): Promise<void> {
	const content = await Deno.readFile(filePath)
	const response = await fetch(`${url}/${hash}`, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: content,
	})

	if (!response.ok)
		throw new Error(`Response status is ${response.status}`)
}

async function markVersionAsFinalized(token: string, versionId: string): Promise<void> {
	const response = await fetch(`https://firebasehosting.googleapis.com/v1beta1/sites/${SITE_ID}/versions/${versionId}?update_mask=status`, {
		method: 'PATCH',
		headers: {
			'Authorization': `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ 'status': 'FINALIZED' }),
	})

	if (!response.ok)
		throw new Error(`Response status is ${response.status}`)
}

async function publishRelease(token: string, versionId: string): Promise<void> {
	const response = await fetch(`https://firebasehosting.googleapis.com/v1beta1/sites/${SITE_ID}/releases?versionName=sites/${SITE_ID}/versions/${versionId}`, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
	})

	if (!response.ok)
		throw new Error(`Response status is ${response.status}`)
}

async function compressFiles(files: string[]) {
	const cmd = ['gzip', ...files]
	const process = Deno.run({ cmd })
	if (!(await process.status()).success)
		throw new Error('gzip process failed')
}

async function shaFiles(files: string[]): Promise<string[]> {
	const cmd = ['openssl', 'dgst', '-sha256', ...files]
	const process = Deno.run({ cmd, stdout: 'piped' })

	const output = await process.output()
	const outputString = new TextDecoder().decode(output)

	if (!(await process.status()).success)
		throw new Error('sha process failed')
	return outputString
		.split('\n')
		.filter(e => e.length > 0)
		.map(line => line.substring(line.lastIndexOf(' ') + 1))
}

async function shaDestFolder() {
	const sums = await shaFiles(hostedFiles.map(name => `${TMP_FOLDER_ROOT}/${FINAL_FILES_FOLDER_NAME}/${name}.gz`))
	return {
		file2hash: Object.fromEntries(
			sums.map((sum, i) => [`/${hostedFiles[i]}`, sum]),
		),
		hash2file: Object.fromEntries(
			sums.map((sum, i) => [sum, `${TMP_FOLDER_ROOT}/${FINAL_FILES_FOLDER_NAME}/${hostedFiles[i]}.gz`]),
		),
	}
}

async function prepareDestFolder(): Promise<void> {
	await Deno.mkdir(`${TMP_FOLDER_ROOT}/${FINAL_FILES_FOLDER_NAME}`)
	await Deno.mkdir(`${TMP_FOLDER_ROOT}/${FINAL_FILES_FOLDER_NAME}/build-js`)
	await Deno.mkdir(`${TMP_FOLDER_ROOT}/${FINAL_FILES_FOLDER_NAME}/build-js/feature-environments`)
	await Promise.all(hostedFiles.map(name => Deno.copyFile(`${TMP_FOLDER_ROOT}/${FOLDER_TO_CLONE}/barbet/${name}`, `${TMP_FOLDER_ROOT}/${FINAL_FILES_FOLDER_NAME}/${name}`)))
	await compressFiles(hostedFiles.map(name => `${TMP_FOLDER_ROOT}/${FINAL_FILES_FOLDER_NAME}/${name}`))
}

async function prepareFileForUploadAndGetHashes() {
	await cleanTmpFolder()
	await createTmpFolder()
	await cloneRepo()
	await buildFrontend()
	await prepareDestFolder()
	return await shaDestFolder()
}

async function prepareAccountAndCreateNewSite() {
	await activateServiceAccount()
	const token = await getAccessToken()

	const firebaseHostingConfig = new TextDecoder().decode(await Deno.readFile(`${TMP_FOLDER_ROOT}/${FOLDER_TO_CLONE}/barbet/firebase-hosting-config.json`))

	const versionId = await createNewSite(token, firebaseHostingConfig)
	return { token, versionId }
}

async function uploadRequiredFiles(token: string, uploadUrl: string, requiredHashes: string, hash2file: { [key: string]: string }) {
	await Promise.all(Object.entries(hash2file).map(([hash, file]) => uploadFile(token, uploadUrl, hash, file)))
}

async function prepareReleaseAndPublishIt() {
	const { file2hash, hash2file } = await prepareFileForUploadAndGetHashes()
	const { token, versionId } = await prepareAccountAndCreateNewSite()

	const { uploadUrl, uploadRequiredHashes } = await populateFiles(token, versionId, file2hash)
	await uploadRequiredFiles(token, uploadUrl, uploadRequiredHashes, hash2file)

	await markVersionAsFinalized(token, versionId)
	await publishRelease(token, versionId)
	await cleanTmpFolder()
}


async function handler(_: Request): Promise<Response> {
	try {
		await prepareReleaseAndPublishIt()

		return new Response(null, { status: 200 })
	} catch (e) {
		console.error(e)
		return new Response(JSON.stringify(e), { status: 500 })
	}
}

const PORT = +(Deno.env.get('PORT') ?? '3000') || 3000
serve(handler, {
	port: PORT,
})


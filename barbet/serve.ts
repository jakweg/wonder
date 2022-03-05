import { serve } from 'https://deno.land/std@0.119.0/http/server.ts'

const cwd = Deno.cwd() + '/'
const extensionsToContentTypeMap: { [key: string]: string } = {
	'html': 'text/html',
	'css': 'text/css',
	'js': 'text/javascript',
}

const handler = async (request: Request): Promise<Response> => {
	let {pathname} = new URL(request.url)

	try {
		if (pathname.includes('..'))
			return new Response(null, {status: 401})

		if (pathname === '/')
			pathname = 'index.html'

		const fullPath = cwd + pathname
		const mtime = (await Deno.stat(fullPath)).mtime as Date
		const ifModifiedSince = new Date(request.headers.get('If-Modified-Since') ?? '').getTime()
		if (!isNaN(ifModifiedSince)) {
			// add 1000, because gmt format doesn't account for milliseconds but stat syscall does
			if (mtime.getTime() <= ifModifiedSince + 1000) {
				return new Response(null, {status: 304})
			}
		}

		const file = Deno.readFile(fullPath)
		let contentType = undefined
		const dotPosition = pathname.lastIndexOf('.')
		if (dotPosition >= 0) {
			const extension = pathname.substring(dotPosition + 1)

			contentType = extensionsToContentTypeMap[extension]
		}
		return new Response(await file, {
			headers: {
				'Content-Type': contentType ?? 'application/octet-stream',
				'Cross-Origin-Opener-Policy': 'same-origin',
				'Cross-Origin-Embedder-Policy': 'require-corp',
				'Content-Security-Policy': `upgrade-insecure-requests; default-src 'self';`,
				'Cache-Control': 'max-age=10',
				'Last-Modified': mtime.toUTCString(),
			},
		})
	} catch (e) {
		if (e.code !== 'ENOENT') // ignore file not found
			console.error(e)
		return new Response(null, {status: 404})
	}
}

console.log('Listening on http://localhost:8000')
serve(handler)

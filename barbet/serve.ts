import { serve } from 'https://deno.land/std@0.119.0/http/server.ts'

const cwd = Deno.cwd() + '/'
const extensionsToContentTypeMap: {[key: string]: string} = {
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

		const file = Deno.readFile(cwd + pathname)
		let contentType = undefined
		const dotPosition = pathname.lastIndexOf('.')
		if (dotPosition >= 0) {
			const extension = pathname.substr(dotPosition + 1)

			contentType = extensionsToContentTypeMap[extension]
		}
		return new Response(await file, {
			headers: {
				'content-type': contentType ?? 'application/octet-stream',
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

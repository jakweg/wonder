import * as esbuild from 'https://deno.land/x/esbuild@v0.14.18/mod.js'

const args = new Set<string>(Deno.args as string[])

const buildForProduction = args.delete('--prod')
const serve = args.delete('--serve')

if (buildForProduction && serve)
	console.warn('Cannot serve and prod build')

if (args.size > 0) {
	console.log('Received unknown options: ', args)
} else {
	const jsOutRoot = 'build-js'
	const config = {
		define: {
			_C_DEBUG: JSON.stringify(!buildForProduction),
			_C_JS_ROOT: JSON.stringify(jsOutRoot),
		},
		entryPoints: [`src/main.ts`, `src/worker.ts`],
		bundle: true,
		treeShaking: buildForProduction,
		sourcemap: (buildForProduction ? false : 'inline') as 'inline',
		minify: buildForProduction,
		outdir: jsOutRoot,
		target: 'es2021',
		watch: buildForProduction ? false : {
			onRebuild(error: any) {
				const now = new Date().toLocaleTimeString()
				console.log(`${now} Build ${error ? 'failed' : 'successful'}`)
			},
		},
	}
	const {errors} = await esbuild.build(config)
	if (errors.length > 0) {
		console.error(errors)
	}
	if (!config.watch) {
		Deno.exit(errors.length > 0 ? 1 : 0)
	} else {
		if (serve)
			await import('./serve.ts')
	}
}

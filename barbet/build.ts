import * as esbuild from 'https://deno.land/x/esbuild@v0.14.18/mod.js'

const args = new Set<string>(Deno.args as string[])

const buildForProduction = args.delete('--prod')
const serve = args.delete('--serve')
const forceSingleThread = args.delete('--env-zero')

if (buildForProduction && serve)
	console.warn('Cannot serve and prod build')
if (buildForProduction && forceSingleThread)
	console.warn('Cannot force single thread and prod build')

if (args.size > 0) {
	console.log('Received unknown options: ', args)
} else {
	const jsOutRoot = 'build-js'
	await Deno.remove(jsOutRoot, {recursive: true})

	const config = {
		define: {
			_C_DEBUG: JSON.stringify(!buildForProduction),
			_C_JS_ROOT: JSON.stringify(`/${jsOutRoot}`),
			_C_FORCE_ENV_ZERO: JSON.stringify(forceSingleThread),
		},
		entryPoints: [
			'main',
			'environments/zero',
			...(forceSingleThread ? [] : [
				'update-worker',
				'render-worker',
				'environments/first',
				'environments/second',
			]),
		].map(name => `src/main/${name}.ts`),
		bundle: true,
		treeShaking: buildForProduction,
		sourcemap: (buildForProduction ? false : 'inline') as 'inline',
		minify: buildForProduction,
		outdir: jsOutRoot,
		target: 'es2021',
		splitting: true,
		format: 'esm',
		watch: buildForProduction ? false : {
			onRebuild(error: any) {
				const now = new Date().toLocaleTimeString()
				console.log(`${now} Build ${error ? 'failed' : 'successful'}`)
			},
		},
	}
	const {errors} = await esbuild.build(config as any)
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

import * as esbuild from 'https://deno.land/x/esbuild@v0.14.25/mod.js'

const args = new Set<string>(Deno.args as string[])

const buildForProduction = args.delete('--prod')
const serve = args.delete('--serve')
const forceSingleThread = args.delete('--env-zero')
const produceMappings = args.delete('--mappings')

if (buildForProduction && serve)
	console.warn('Cannot serve and prod build')
if (buildForProduction && forceSingleThread)
	console.warn('Cannot force single thread and prod build')
if (!buildForProduction && produceMappings)
	console.warn('Mappings are only produced in production mode')

if (args.size > 0) {
	console.log('Received unknown options: ', args)
} else {
	const jsOutRoot = 'build-js'
	try {
		await Deno.remove(jsOutRoot, {recursive: true})
	} catch (_) { // ignore, probably missing folder
	}

	const entryPoints = [
		'main',
		'environments/zero',
		...(forceSingleThread ? [] : [
			'update-worker',
			'render-worker',
			'environments/first',
			'environments/second',
		]),
	]
	const config = {
		define: {
			_C_DEBUG: JSON.stringify(!buildForProduction),
			_C_JS_ROOT: JSON.stringify(`/${jsOutRoot}`),
			_C_FORCE_ENV_ZERO: JSON.stringify(forceSingleThread),
		},
		entryPoints: entryPoints.map(name => `src/main/${name}.ts`),
		bundle: true,
		treeShaking: buildForProduction,
		sourcemap: (buildForProduction ? false : 'inline') as 'inline',
		outdir: jsOutRoot,
		target: 'es2021',
		splitting: false,
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
	if (config.watch && serve) {
		await import('./serve.ts')
	} else {
		if (buildForProduction) {
			const mangleExcludedPropNames: readonly string[] = (await import('./props-mangle-exclusions.ts')).default

			const results = await esbuild.build({
				entryPoints: entryPoints.map(e => `${jsOutRoot}/${e}.js`),
				minify: true,
				outdir: jsOutRoot,
				allowOverwrite: true,
				format: 'esm',
				mangleProps: /./,
				mangleCache: {
					...Object.fromEntries(mangleExcludedPropNames.map(e => [e, false])),
				},
			} as any)
			if (produceMappings)
				await Deno.writeTextFile('./mappings.txt', JSON.stringify(results.mangleCache, undefined, 3))
		}
		Deno.exit(0)
	}
}

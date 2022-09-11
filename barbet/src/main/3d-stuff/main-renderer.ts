import { DEBUG } from '../util/build-info'
import CONFIG from '../util/persistance/observable-settings'
import GPUBuffer from './gpu-resources/buffer'
import GlProgram from './gpu-resources/program'
import VertexArray from './gpu-resources/vao'

const TEXTURE_PIXEL_MULTIPLIER = 1 // set 1 / 2 for half-resolution rendering

type AllocatedResourceEntry = { id: any, type: 'shader' | 'program' | 'buffer' | 'vertex-array' }

const obtainWebGl2ContextFromCanvas = (canvas: HTMLCanvasElement): WebGL2RenderingContext => {
	const context = canvas.getContext('webgl2', {
		'alpha': false,
		'antialias': CONFIG.get('rendering/antialias'),
		'depth': true,
		'stencil': false,
		'failIfMajorPerformanceCaveat': true,
	}) as WebGL2RenderingContext
	if (context == null)
		throw new Error('Unable to obtain context')
	return context
}


const getAllUniforms = (gl: WebGL2RenderingContext, program: WebGLProgram) => {
	const allNames: string[] = []
	const count: number = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS)
	for (let i = 0; i < count; i++) {
		const name = gl.getActiveUniform(program, i)!['name']
		if (name.startsWith('gl_'))
			continue
		if (!name.startsWith('u_'))
			throw new Error(`Uniform name '${name}' doesn't start with proper prefix`)
		allNames.push(name)
	}
	const mapped = Object.fromEntries(allNames.map((name) => ([name.substring(2), gl.getUniformLocation(program, name)])))
	return DEBUG ? { ...mapped, names: allNames } : mapped
}

const getAllAttributes = (gl: WebGL2RenderingContext, program: WebGLProgram) => {
	const allNames: string[] = []
	const count: number = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES)
	for (let i = 0; i < count; i++) {
		const name = gl.getActiveAttrib(program, i)!['name']
		if (name.startsWith('gl_'))
			continue
		if (!name.startsWith('a_'))
			throw new Error(`Attribute name '${name}' doesn't start with proper prefix`)
		allNames.push(name)
	}
	const mapped = Object.fromEntries(allNames.map((name) => [name.substring(2), gl.getAttribLocation(program, name)]))
	return DEBUG ? { ...mapped, names: allNames } : mapped
}

export type RenderFunction = (gl: WebGL2RenderingContext, secondsSinceLastFrame: number) => void | Promise<void>
export type BeforeRenderFunction = (secondsSinceLastFrame: number) => boolean | Promise<boolean>


export class MainRenderer {
	public width: number = 0
	public height: number = 0
	private nextFrameRequest: number = 0
	private readonly allocatedResources: AllocatedResourceEntry[] = []
	private lastFrameTime = 0
	private lastWidth: number = -1
	private lastHeight: number = -1

	private constructor(
		private readonly canvas: HTMLCanvasElement,
		private readonly gl: WebGL2RenderingContext) {
	}

	public get rawContext(): WebGL2RenderingContext {
		return this.gl
	}

	static fromHTMLCanvas(canvas: HTMLCanvasElement): MainRenderer {
		return new MainRenderer(canvas, obtainWebGl2ContextFromCanvas(canvas))
	}

	public renderFunction: RenderFunction = () => void 0

	public beforeRenderFunction: BeforeRenderFunction = () => true

	public createShader(vertex: boolean, source: string): WebGLShader {
		const gl = this.gl
		const shader = gl.createShader(vertex ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER)!

		if (source.startsWith(' ') || source.startsWith('\n'))
			source = source.trimStart()

		gl.shaderSource(shader, source)
		gl.compileShader(shader)
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			if (DEBUG) {
				console.error(source)
				console.error(gl.getShaderInfoLog(shader))
			}
			gl.deleteShader(shader)
			throw new Error('Shader compilation failed')
		}

		this.allocatedResources.push({ type: 'shader', id: shader })

		return shader
	}

	public createProgram<Attributes = string, Uniforms = string>(
		vertex: WebGLShader,
		fragment: WebGLShader):
		GlProgram<Attributes, Uniforms> {

		const gl = this.gl
		const program = gl.createProgram()!
		gl.attachShader(program, vertex)
		gl.attachShader(program, fragment)
		gl.linkProgram(program)
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			console.error(gl.getProgramInfoLog(program))
			gl.deleteProgram(program)
			throw new Error('Program link failed')
		}

		this.allocatedResources.push({ type: 'program', id: program })

		return new GlProgram<Attributes, Uniforms>(
			gl, program,
			getAllUniforms(gl, program) as unknown as any,
			getAllAttributes(gl, program) as unknown as any,
		)
	}

	public createBuffer(forArray: boolean,
		dynamic: boolean): GPUBuffer {
		const gl = this.gl
		const buffer = gl.createBuffer()!

		this.allocatedResources.push({ id: buffer, type: 'buffer' })

		const usage = dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW
		const target = forArray ? gl.ARRAY_BUFFER : gl.ELEMENT_ARRAY_BUFFER
		return new GPUBuffer(gl, buffer, target, usage)
	}

	public createVAO() {
		const gl = this.gl
		const array = gl.createVertexArray()!
		this.allocatedResources.push({ id: array, type: 'vertex-array' })
		return new VertexArray(gl, array)
	}

	public unbindVAO() {
		this.gl.bindVertexArray(null)
	}

	public beginRendering() {
		if (this.nextFrameRequest !== 0) return

		const gl = this.gl
		this.lastFrameTime = performance.now()

		const render = async () => {
			const now = performance.now()
			const elapsedSeconds = (now - this.lastFrameTime) / 1000
			if ((await this.beforeRenderFunction(elapsedSeconds)) === true) {
				await this.renderFunction(gl, elapsedSeconds)
			}

			// someone could cancel rendering in render callback
			if (this.nextFrameRequest !== 0)
				this.nextFrameRequest = requestAnimationFrame(render)
		}
		this.nextFrameRequest = requestAnimationFrame(render)
	}

	public stopRendering() {
		cancelAnimationFrame(this.nextFrameRequest)
		this.nextFrameRequest = 0
	}

	public cleanUp() {
		const gl = this.gl
		for (const res of [...this.allocatedResources].reverse()) {
			switch (res.type) {
				case 'shader':
					gl.deleteShader(res.id)
					break
				case 'program':
					gl.deleteProgram(res.id)
					break
				case 'buffer':
					gl.deleteBuffer(res.id)
					break
				case 'vertex-array':
					gl.deleteVertexArray(res.id)
					break
			}
		}
		this.allocatedResources.splice(0)

		gl['getExtension']('WEBGL_lose_context')?.['loseContext']?.();
	}

	public renderStarted() {
		this.lastFrameTime = performance.now()
		this.setUpFrameBeforeRender(this.gl)
	}

	private setUpFrameBeforeRender(gl: WebGL2RenderingContext) {
		if (this.lastWidth !== this.width || this.lastHeight != this.height) {
			this.lastWidth = this.width
			this.lastHeight = this.height

			this.canvas['width'] = this.width * TEXTURE_PIXEL_MULTIPLIER | 0
			this.canvas['height'] = this.height * TEXTURE_PIXEL_MULTIPLIER | 0
		}
		gl.viewport(0, 0, this.width * TEXTURE_PIXEL_MULTIPLIER | 0, this.height * TEXTURE_PIXEL_MULTIPLIER | 0)

		gl.clearColor(0.15, 0.15, 0.15, 1)
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

		gl.enable(gl.DEPTH_TEST)
		gl.depthFunc(gl.LEQUAL)

		gl.cullFace(gl.BACK)
		gl.enable(gl.CULL_FACE)
	}
}



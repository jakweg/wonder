type AllocatedResourceEntry = { id: any, type: 'shader' | 'program' | 'buffer' | 'vertex-array' }

const obtainWebGl2ContextFromCanvas = (canvas: HTMLCanvasElement): WebGL2RenderingContext => {
	const context = canvas.getContext('webgl2', {
		alpha: false,
		antialias: false,
		depth: true,
		stencil: false,
		failIfMajorPerformanceCaveat: true,
		powerPreference: 'low-power',
	}) as WebGL2RenderingContext
	if (context == null)
		throw new Error('Unable to obtain context')
	return context
}


const getAllUniforms = (gl: WebGL2RenderingContext, program: WebGLProgram) => {
	const allNames: string[] = []
	const count: number = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS)
	for (let i = 0; i < count; i++) {
		const name = gl.getActiveUniform(program, i)!.name
		if (name.startsWith('gl_'))
			continue
		if (!name.startsWith('u_'))
			throw new Error(`Uniform name '${name}' doesn't start with proper prefix`)
		allNames.push(name)
	}
	return {
		...Object.fromEntries(allNames.map((name) => ([name.substr(2), gl.getUniformLocation(program, name)]))),
		names: allNames,
	}
}

const getAllAttributes = (gl: WebGL2RenderingContext, program: WebGLProgram) => {
	const allNames: string[] = []
	const count: number = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES)
	for (let i = 0; i < count; i++) {
		const name = gl.getActiveAttrib(program, i)!.name
		if (name.startsWith('gl_'))
			continue
		if (!name.startsWith('a_'))
			throw new Error(`Attribute name '${name}' doesn't start with proper prefix`)
		allNames.push(name)
	}
	// allNames.forEach(name => gl.enableVertexAttribArray(gl.getAttribLocation(program, name)))
	return {
		...Object.fromEntries(allNames.map((name) => [name.substr(2), gl.getAttribLocation(program, name)])),
		names: allNames,
	}
}

export type RenderFunction = (gl: WebGL2RenderingContext, secondsSinceLastFrame: number) => void
export type BeforeRenderFunction = (secondsSinceLastFrame: number) => boolean


export class MainRenderer {
	private nextFrameRequest: number = 0
	private readonly allocatedResources: AllocatedResourceEntry[] = []

	private constructor(
		private readonly canvas: HTMLCanvasElement,
		private readonly gl: WebGL2RenderingContext,
	) {
	}

	public get rawContext(): WebGL2RenderingContext {
		return this.gl
	}

	public renderFunction: RenderFunction = () => void 0
	public beforeRenderFunction: BeforeRenderFunction = () => true

	static fromHTMLCanvas(canvas: HTMLCanvasElement): MainRenderer {
		return new MainRenderer(canvas, obtainWebGl2ContextFromCanvas(canvas))
	}

	public createShader(vertex: boolean, source: string): WebGLShader {
		const gl = this.gl
		const shader = gl.createShader(vertex ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER)!

		gl.shaderSource(shader, source)
		gl.compileShader(shader)
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			console.error(gl.getShaderInfoLog(shader))
			gl.deleteShader(shader)
			throw new Error('Shader compilation failed')
		}

		this.allocatedResources.push({type: 'shader', id: shader})

		return shader
	}

	public createProgram<Uniforms = string, Attributes = string>(
		vertex: WebGLShader,
		fragment: WebGLShader):
// @ts-ignore
		GlProgram<Uniforms, Attributes> {

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

		this.allocatedResources.push({type: 'program', id: program})

		// @ts-ignore
		return new GlProgram<Uniforms, Attributes>(
			gl, program,
			getAllUniforms(gl, program) as unknown as any,
			getAllAttributes(gl, program) as unknown as any,
		)
	}

	public createBuffer(forArray: boolean,
	                    dynamic: boolean): GPUBuffer {
		const gl = this.gl
		const buffer = gl.createBuffer()!

		this.allocatedResources.push({id: buffer, type: 'buffer'})

		const usage = dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW
		const target = forArray ? gl.ARRAY_BUFFER : gl.ELEMENT_ARRAY_BUFFER
		return new GPUBuffer(gl, buffer, target, usage)
	}

	public createVAO() {
		const gl = this.gl
		const array = gl.createVertexArray()!
		this.allocatedResources.push({id: array, type: 'vertex-array'})
		return new VertexArray(gl, array)
	}

	public beginRendering() {
		if (this.nextFrameRequest !== 0) return

		const gl = this.gl

		let lastFrameTime = Date.now()
		const render = () => {
			const now = Date.now()
			const elapsedSeconds = (now - lastFrameTime) / 1000
			if (this.beforeRenderFunction(elapsedSeconds)) {
				lastFrameTime = now

				gl.clearColor(0.1, 0.1, 0.1, 1)
				gl.clear(gl.COLOR_BUFFER_BIT)

				this.renderFunction(gl, elapsedSeconds)
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
	}
}

class VertexArray {
	constructor(
		private readonly gl: WebGL2RenderingContext,
		private readonly array: WebGLVertexArrayObject) {
	}

	public bind() {
		this.gl.bindVertexArray(this.array)
	}
}

export class GlProgram<U extends 'names', A extends 'names'> {
	constructor(private readonly gl: WebGL2RenderingContext,
	            private readonly program: WebGLProgram,
	            readonly uniforms: { [key in U]: WebGLUniformLocation },
	            readonly attributes: { [key in A]: GLint }) {
	}

	public use() {
		this.gl.useProgram(this.program)
	}

	public enableAttribute(attribute: GLint,
	                       floatsPerVertex: number,
	                       stride: number,
	                       offset: number,
	                       instancesDivisor: number) {
		const gl = this.gl
		gl.enableVertexAttribArray(attribute)
		gl.vertexAttribPointer(attribute, floatsPerVertex | 0, gl.FLOAT, false, stride | 0, offset | 0)
		gl.vertexAttribDivisor(attribute, instancesDivisor | 0)
	}
}


export class GPUBuffer {
	constructor(
		private readonly gl: WebGL2RenderingContext,
		private readonly id: WebGLBuffer,
		private readonly target: GLenum,
		private readonly usage: GLenum) {
	}

	public bind() {
		this.gl.bindBuffer(this.target, this.id)
	}

	public setContent(data: Float32Array) {
		const gl = this.gl
		const target = this.target
		gl.bindBuffer(target, this.id)
		gl.bufferData(target, data, this.usage)
	}
}

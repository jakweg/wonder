export const VersionHeader = () => `#version 300 es`

export const PrecisionHeader = () => `precision mediump float;`

type AllocatedResourceEntry = { id: any, type: 'shader' | 'program' | 'buffer' | 'vertex-array' }

export interface GlApplicationResourcesContext {
	readonly canvas: HTMLCanvasElement,
	readonly gl: WebGL2RenderingContext,
	readonly allocatedResources: AllocatedResourceEntry[]
}

export const newGlResourcesContext = (canvas: HTMLCanvasElement,
                                      ctx: WebGL2RenderingContext): GlApplicationResourcesContext => ({
	canvas: canvas,
	gl: ctx,
	allocatedResources: [],
})

export const createShader = (ctx: GlApplicationResourcesContext, vertex: boolean, source: string): WebGLShader => {
	const gl = ctx.gl
	const shader = gl.createShader(vertex ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER)!

	gl.shaderSource(shader, source)
	gl.compileShader(shader)
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.error(gl.getShaderInfoLog(shader))
		gl.deleteShader(shader)
		throw new Error('Shader compilation failed')
	}

	ctx.allocatedResources.push({type: 'shader', id: shader})

	return shader
}

function getAllUniforms(gl: WebGL2RenderingContext, program: WebGLProgram) {
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

function getAllAttributes(gl: WebGL2RenderingContext, program: WebGLProgram) {
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
	allNames.forEach(name => gl.enableVertexAttribArray(gl.getAttribLocation(program, name)))
	return {
		...Object.fromEntries(allNames.map((name) => [name.substr(2), gl.getAttribLocation(program, name)])),
		names: allNames,
	}
}

interface GlProgram<U extends 'names', A extends 'names'> {
	readonly program: WebGLProgram
	readonly uniforms: { [key in U]: WebGLUniformLocation }
	readonly attributes: { [key in A]: GLint }
}

export const createProgram = <Uniforms = string, Attributes = string>(ctx: GlApplicationResourcesContext,
                                                                      vertex: WebGLShader,
                                                                      fragment: WebGLShader):
// @ts-ignore
	GlProgram<Uniforms, Attributes> => {

	const gl = ctx.gl
	const program = gl.createProgram()!
	gl.attachShader(program, vertex)
	gl.attachShader(program, fragment)
	gl.linkProgram(program)
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error(gl.getProgramInfoLog(program))
		gl.deleteProgram(program)
		throw new Error('Program link failed')
	}

	ctx.allocatedResources.push({type: 'program', id: program})

	return {
		program,
		uniforms: getAllUniforms(gl, program) as unknown as any,
		attributes: getAllAttributes(gl, program) as unknown as any,
	}
}

interface GlBuffer {
	readonly id: WebGLBuffer
	readonly target: GLenum
	readonly usage: GLenum
}

export const createBuffer = (ctx: GlApplicationResourcesContext,
                             target: GLenum,
                             dynamic: boolean): GlBuffer => {
	const gl = ctx.gl
	const buffer = gl.createBuffer()!
	ctx.allocatedResources.push({id: buffer, type: 'buffer'})
	return {id: buffer, target, usage: dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW}
}

export const setBufferContent = (ctx: GlApplicationResourcesContext,
                                 buffer: GlBuffer,
                                 data: Float32Array) => {
	const gl = ctx.gl
	const target = buffer.target
	gl.bindBuffer(target, buffer.id)
	gl.bufferData(target, data, buffer.usage)
}


export const createVertexArray = (ctx: GlApplicationResourcesContext): WebGLVertexArrayObject => {
	const gl = ctx.gl
	const array = gl.createVertexArray()!

	ctx.allocatedResources.push({id: array, type: 'vertex-array'})

	return array
}

// 	const vertexArray = gl.createVertexArray()
// 	gl.bindVertexArray(vertexArray)
//
// 	const positionsBuffer = gl.createBuffer()
// 	gl.bindBuffer(gl.ARRAY_BUFFER, positionsBuffer)
// 	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
// 		-1, -1, 0,
// 		1, -1, 0,
// 		0, 1, 0,
// 	]), gl.DYNAMIC_DRAW)
// 	gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0)
// 	gl.enableVertexAttribArray(0)

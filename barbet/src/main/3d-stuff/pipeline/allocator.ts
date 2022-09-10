import { DEBUG } from "../../util/build-info"
import { GlProgram, GPUBuffer, VertexArray } from "../main-renderer"

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

export const newGpuAllocator = (gl: WebGL2RenderingContext) => {

    let resolveProgramsInstantly = false
    const programsToResolve: (() => void)[] = []

    return {
        endProgramCompilationPhase() {
            resolveProgramsInstantly = true
            for (const p of programsToResolve)
                p()
            programsToResolve.length = 0
        },

        newProgram<Attributes, Uniforms>(params: {
            vertexSource: string,
            fragmentSource: string
        }): Promise<GlProgram<Attributes, Uniforms>> {
            const vertexShader = gl.createShader(gl.VERTEX_SHADER)!
            gl.shaderSource(vertexShader, params.vertexSource.trim())
            gl.compileShader(vertexShader)

            const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!
            gl.shaderSource(fragmentShader, params.fragmentSource.trim())
            gl.compileShader(fragmentShader)

            const program = gl.createProgram()!
            gl.attachShader(program, vertexShader)
            gl.attachShader(program, fragmentShader)
            gl.linkProgram(program)

            return new Promise((resolve, reject) => {
                const callback = () => {
                    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                        console.error(`${gl.getProgramInfoLog(program)}`);
                        console.error(`vs: ${gl.getShaderInfoLog(vertexShader)}`);
                        console.error(`fs: ${gl.getShaderInfoLog(fragmentShader)}`);

                        reject('Failed to compile program')
                        return
                    }

                    resolve(new GlProgram<Attributes, Uniforms>(
                        gl, program,
                        getAllUniforms(gl, program) as unknown as any,
                        getAllAttributes(gl, program) as unknown as any,
                    ))
                }
                if (resolveProgramsInstantly)
                    callback()
                else
                    programsToResolve.push(callback)
            })
        },

        newVao() {
            const array = gl.createVertexArray()!
            return new VertexArray(gl, array)
        },

        newBuffer(options: { dynamic: boolean, forArray: boolean }) {
            const buffer = gl.createBuffer()!

            const usage = options.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW
            const target = options.forArray ? gl.ARRAY_BUFFER : gl.ELEMENT_ARRAY_BUFFER
            return new GPUBuffer(gl, buffer, target, usage)
        }
    }
}
export type GpuAllocator = ReturnType<typeof newGpuAllocator>
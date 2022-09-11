
export default class GlProgram<A, U> {
    constructor(private readonly gl: WebGL2RenderingContext,
        private readonly program: WebGLProgram,
        readonly uniforms: {
            // @ts-ignore
            [key in U]: WebGLUniformLocation;
        },
        readonly attributes: {
            // @ts-ignore
            [key in A]: GLint;
        }) {
    }

    public use() {
        this.gl.useProgram(this.program);
    }

    /**
     *
     * @param attribute
     * @param size number of floats per attribute (eg 3 for vec3)
     * @param float true if use float, false for unsigned short
     * @param stride number of bytes in each set of data (eg 5 when each vertex shader call receives vec3 and vec2)
     * @param offset
     * @param divisor
     */
    public enableAttribute(attribute: GLint | undefined,
        size: number,
        float: boolean,
        stride: number,
        offset: number,
        divisor: number) {
        if (attribute === undefined)
            return;
        const gl = this.gl;
        gl.enableVertexAttribArray(attribute);
        if (float) {
            gl.vertexAttribPointer(attribute, size | 0, gl.FLOAT, false, stride | 0, offset | 0);
        } else {
            gl.vertexAttribIPointer(attribute, size | 0, gl.INT, stride | 0, offset | 0);
        }
        gl.vertexAttribDivisor(attribute, divisor | 0);
    }
}

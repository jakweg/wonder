
type AttributeSpecification = {
    size: number,
    divisor?: number,
    isInt?: boolean
}

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

    // @ts-ignore
    public useAttributes(attributes: Readonly<Partial<{ [key in A | ('_' | '__' | '___')]: AttributeSpecification }>>): void {
        const gl = this.gl;
        const entries = Object.entries(attributes) as [A, AttributeSpecification][]

        const totalSize = entries.map(([_, v]) => v.size * Float32Array.BYTES_PER_ELEMENT).reduce((a, b) => a + b, 0)

        let offset = 0
        for (const [key, attribute] of entries) {
            const index = this.attributes[key]
            if (index !== undefined) {
                gl.enableVertexAttribArray(index)
                gl.vertexAttribPointer(index, attribute.size, attribute.isInt ? gl.INT : gl.FLOAT, false, totalSize, offset * Float32Array.BYTES_PER_ELEMENT)
                gl.vertexAttribDivisor(index, (attribute.divisor ?? 0) | 0);
            }
            offset += attribute.size
        }
    }
}

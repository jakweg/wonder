
export enum AttrType {
    Float,
    UByte,
    UShort,
}

const isInt = (type: AttrType) => type !== AttrType.Float
const getBytesSize = (type: AttrType) => {
    switch (type) {
        case AttrType.Float: return 4
        case AttrType.UShort: return 2
        case AttrType.UByte: return 1
        default: throw new Error()
    }
}
const getGlValue = (gl: WebGL2RenderingContext, type: AttrType) => {
    switch (type) {
        case AttrType.Float: return gl['FLOAT']
        case AttrType.UShort: return gl['UNSIGNED_SHORT']
        case AttrType.UByte: return gl['UNSIGNED_BYTE']
        default: throw new Error()
    }
}

type AttributeSpecification = {
    count: number
    type?: AttrType
    divisor?: number
    normalize?: boolean
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

        const totalSize = entries.map(([_, v]) => v.count * getBytesSize(v.type ?? AttrType.Float)).reduce((a, b) => a + b, 0)

        let offset = 0
        for (const [key, attribute] of entries) {
            const index = this.attributes[key]
            const type = attribute.type ?? AttrType.Float
            if (index !== undefined) {
                gl.enableVertexAttribArray(index)
                if (attribute?.normalize === undefined ? isInt(type) : false)
                    gl.vertexAttribIPointer(index,
                        attribute.count,
                        getGlValue(gl, type),
                        totalSize,
                        offset)
                else
                    gl.vertexAttribPointer(index,
                        attribute.count,
                        getGlValue(gl, type),
                        attribute?.normalize ?? false,
                        totalSize,
                        offset)
                gl.vertexAttribDivisor(index, (attribute.divisor ?? 0) | 0);
            }
            offset += attribute.count * getBytesSize(type)
        }
    }
}

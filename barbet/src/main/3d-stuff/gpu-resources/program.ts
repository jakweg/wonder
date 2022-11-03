
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
    type: AttrType
    divisor?: number
    normalize?: boolean
}

export default class GlProgram<A extends string, U extends string> {
    constructor(private readonly gl: WebGL2RenderingContext,
        private readonly program: WebGLProgram,
        readonly uniforms: {
            [key in U]: WebGLUniformLocation;
        },
        readonly attributes: {
            [key in A]: GLint;
        }) {
    }

    public use() {
        this.gl.useProgram(this.program);
    }

    public useAttributes(attributes: Readonly<Partial<{ [key in A | ('_' | '__' | '___')]: AttributeSpecification }>>): void {
        const gl = this.gl;
        const entries = Object.entries(attributes) as [A, AttributeSpecification][]

        const totalSize = entries.map(([_, v]) => v.count * getBytesSize(v.type))['reduce']((a, b) => a + b, 0)

        let offset = 0
        for (const [key, attribute] of entries) {
            const index = this.attributes[key]
            const type = attribute.type
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

                if (attribute.divisor !== undefined)
                    gl.vertexAttribDivisor(index, attribute.divisor);
            }
            offset += attribute.count * getBytesSize(type)
        }
    }
}

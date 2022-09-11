
export default class VertexArray {
    constructor(
        private readonly gl: WebGL2RenderingContext,
        private readonly array: WebGLVertexArrayObject) {
    }

    public bind() {
        this.gl.bindVertexArray(this.array);
    }

    public unbind() {
        this.gl.bindVertexArray(null);
    }
}

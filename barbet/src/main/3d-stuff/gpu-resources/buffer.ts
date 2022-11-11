import TypedArray from "@seampan/typed-array"

export default class GPUBuffer {
  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly id: WebGLBuffer,
    private readonly target: GLenum,
    private readonly usage: GLenum,
  ) { }

  public bind() {
    this.gl.bindBuffer(this.target, this.id)
  }
  public rawHandle() {
    return this.id
  }

  public setContent(data: TypedArray) {
    const gl = this.gl
    const target = this.target
    gl.bindBuffer(target, this.id)
    gl.bufferData(target, data, this.usage)
  }

  public setPartialContent(data: TypedArray, sourceOffset: number, length: number) {
    const gl = this.gl
    const target = this.target
    gl.bindBuffer(target, this.id)
    gl.bufferData(target, data, this.usage, sourceOffset, length)
  }
}

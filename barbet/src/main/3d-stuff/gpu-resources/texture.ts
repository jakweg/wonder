export default class GPUTexture {
  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly id: WebGLTexture,
    public readonly slot: number,
  ) {}

  public bind() {
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.id)
  }
  public setActive() {
    this.gl.activeTexture(this.gl.TEXTURE0 + this.slot)
    this.bind()
  }

  public setContent(data: Uint8Array | Uint8ClampedArray, sizeInOneDimension: number) {
    const gl = this.gl
    this.setActive()

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8UI,
      sizeInOneDimension,
      sizeInOneDimension,
      0,
      gl.RED_INTEGER,
      gl.UNSIGNED_BYTE,
      data,
    )
  }
}

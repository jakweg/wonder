export default interface DrawingContext {
  drawArrays(firstVertexIndex: number, vertexCount: number): void
  drawArraysInstanced(firstVertexIndex: number, vertexCount: number, instanceCount: number): void
  multiDrawArrays(firstsList: Int32Array, countsList: Int32Array, drawsCount: number): void
}

export const newDrawingContextFromGl = (gl: WebGL2RenderingContext): DrawingContext => {
  const triangles = gl.TRIANGLES

  const multiDrawExtension = gl.getExtension('WEBGL_multi_draw')

  const multiDrawArrays: DrawingContext['multiDrawArrays'] = multiDrawExtension
    ? (firstsList, countsList, drawsCount) => {
        multiDrawExtension.multiDrawArraysWEBGL(triangles, firstsList, 0, countsList, 0, drawsCount)
      }
    : (firstsList, countsList, drawsCount) => {
        for (let i = 0; i < drawsCount; ++i) {
          gl.drawArrays(triangles, firstsList[i]!, countsList[i]!)
        }
      }

  return {
    drawArrays(firstVertexIndex, vertexCount) {
      gl.drawArrays(triangles, firstVertexIndex, vertexCount)
    },
    drawArraysInstanced(firstVertexIndex, vertexCount, instanceCount) {
      gl.drawArraysInstanced(triangles, firstVertexIndex, vertexCount, instanceCount)
    },
    multiDrawArrays,
  }
}

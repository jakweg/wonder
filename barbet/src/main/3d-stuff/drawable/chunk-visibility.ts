import { GENERIC_CHUNK_SIZE } from '@game/world/size'

enum Status {
  INVISIBLE = 0,
  VISIBLE = 1,
}

const check2dPointVisibility = (x: number, z: number, matrix: any, threshold: number): boolean => {
  const rw = matrix[3] * x + matrix[11] * z + matrix[15]

  const rx = (matrix[0] * x + matrix[8] * z + matrix[12]) / rw
  if (rx < -threshold || rx > threshold) return false

  const ry = (matrix[1] * x + matrix[9] * z + matrix[13]) / rw
  if (ry < -threshold || ry > threshold) return false

  const rz = (matrix[2] * x + matrix[10] * z + matrix[14]) / rw
  if (rz < -threshold || rz > threshold) return false

  return true
}

export default class ChunkVisibilityIndex {
  private cullingDisabled: boolean = false
  private readonly visibleChunkIds: number[] = []

  private constructor(private readonly size: number, private readonly visibility: Uint8Array) {
    visibility.fill(Status.INVISIBLE)
    this.setCullingDisabled(true) // TODO remove
  }

  public static create(size: number): ChunkVisibilityIndex {
    return new ChunkVisibilityIndex(size, new Uint8Array(size * size))
  }

  public getVisibleChunkIds(): Readonly<Array<number>> {
    return this.visibleChunkIds
  }

  public setCullingDisabled(disabled: boolean, matrixToUpdate?: any): void {
    if (this.cullingDisabled === disabled) return
    this.cullingDisabled = disabled

    if (disabled) {
      this.visibility.fill(Status.VISIBLE)
      this.visibleChunkIds.length = 0
      for (let i = 0; i < this.size * this.size; i++) {
        this.visibleChunkIds.push(i)
      }
    } else if (matrixToUpdate) this.update(matrixToUpdate)
  }

  /** @returns number of visible chunks */
  public update(matrix: any): number {
    if (this.cullingDisabled) return this.visibility.length
    this.visibility.fill(Status.INVISIBLE)

    const threshold = 1

    let visibleCounter = 0
    let chunkIndex = 0
    for (let i = 0, li = this.size; i < li; i++) {
      for (let j = 0, lj = this.size; j < lj; j++) {
        const visible = check2dPointVisibility(i * GENERIC_CHUNK_SIZE, j * GENERIC_CHUNK_SIZE, matrix, threshold)
        if (visible) {
          visibleCounter++
          this.visibility[chunkIndex] = Status.VISIBLE
          this.visibility[chunkIndex - 1] = Status.VISIBLE
          this.visibility[chunkIndex - li] = Status.VISIBLE
          this.visibility[chunkIndex - li - 1] = Status.VISIBLE
        }

        chunkIndex++
      }
    }

    this.visibleChunkIds.length = 0
    for (let i = 0; i < this.size * this.size; i++) {
      if (this.isChunkIndexVisible(i)) {
        this.visibleChunkIds.push(i)
      }
    }

    return visibleCounter
  }

  public isPointInViewport(pointX: number, pointZ: number): boolean {
    const chunkX = (pointX / GENERIC_CHUNK_SIZE) | 0
    const chunkZ = (pointZ / GENERIC_CHUNK_SIZE) | 0

    if (chunkX < 0 || chunkX >= this.size || chunkZ < 0 || chunkZ >= this.size) return false

    const chunkIndex = (chunkX * this.size + chunkZ) | 0
    return this.isChunkIndexVisible(chunkIndex)
  }

  public isChunkIndexVisible(chunkIndex: number): boolean {
    const status = this.visibility[chunkIndex]!
    return status === Status.VISIBLE
  }
}

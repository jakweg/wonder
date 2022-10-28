import { WORLD_CHUNK_SIZE } from "../../game-state/world/world"

enum Status {
    INVISIBLE = 0,
    VISIBLE = 1,
}

const check2dPointVisibility = (x: number, z: number, matrix: any, threshold: number): boolean => {
    const rw = matrix[3] * x + matrix[11] * z + matrix[15]

    const rx = (matrix[0] * x + matrix[8] * z + matrix[12]) / rw
    if (rx < -threshold || rx > threshold)
        return false

    const ry = (matrix[1] * x + matrix[9] * z + matrix[13]) / rw
    if (ry < -threshold || ry > threshold)
        return false

    // const rz = (matrix[2] * x + matrix[10] * z + matrix[14]) / rw
    // if (rz < -threshold || rz > threshold)
    //     return false

    return true
}

export default class ChunkVisibilityIndex {
    private constructor(
        private readonly sizeX: number,
        private readonly sizeY: number,
        private readonly visibility: Uint8Array,
    ) {
        visibility.fill(Status.INVISIBLE)
    }

    public static create(sizeX: number, sizeY: number): ChunkVisibilityIndex {
        return new ChunkVisibilityIndex(sizeX, sizeY, new Uint8Array(sizeX * sizeY))
    }

    /** @returns number of visible chunks */
    public update(matrix: any): number {
        this.visibility.fill(Status.INVISIBLE)

        const threshold = 1

        let visibleCounter = 0
        let chunkIndex = 0
        for (let i = 0, li = this.sizeX; i < li; i++) {
            for (let j = 0, lj = this.sizeY; j < lj; j++) {
                const visible = check2dPointVisibility(i * WORLD_CHUNK_SIZE, j * WORLD_CHUNK_SIZE, matrix, threshold)
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
        return visibleCounter
    }

    public isPointInViewport(pointX: number, pointZ: number): boolean {
        const chunkX = (pointX / WORLD_CHUNK_SIZE) | 0
        const chunkZ = (pointZ / WORLD_CHUNK_SIZE) | 0

        if (chunkX < 0 || chunkX >= this.sizeX || chunkZ < 0 || chunkZ >= this.sizeY)
            return false

        const chunkIndex = (chunkX * this.sizeY + chunkZ) | 0
        return this.isChunkIndexVisible(chunkIndex)
    }

    public isChunkIndexVisible(chunkIndex: number): boolean {
        const status = this.visibility[chunkIndex]!
        return status === Status.VISIBLE
    }
}
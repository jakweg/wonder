import { GENERIC_CHUNK_SIZE } from '@game/world/size'
import { ArrayEncodingType, setArrayEncodingType } from '@utils/persistence/serializers'
import { AIR_ID } from '../world/block'
import { World } from '../world/world'
import { buildChunkMesh, Mesh, moveChunkMesh } from '../world/world-to-mesh-converter'
import { BuildingMesh } from './'

export const decodeVertexesAndIndices = (data: any, inProgressStatesCount: number): BuildingMesh => {
  setArrayEncodingType(ArrayEncodingType.String)
  const world = World.deserialize(data)
  setArrayEncodingType(ArrayEncodingType.None)

  const solidBlocks = countSolidBlocksInWorld(world)
  const states = createInProgressStates(world, inProgressStatesCount, solidBlocks)
  return {
    finished: states.shift()!,
    inProgressStates: states,
  }
}

const countSolidBlocksInWorld = (world: World): number => {
  let count = 0
  for (const blockId of world.rawBlockData) {
    if (blockId !== AIR_ID) count++
  }
  return count
}

const createInProgressStates = (world: World, statesCount: number, totalNonAirBlocks: number): Mesh[] => {
  const chunkSize = world.sizeLevel * GENERIC_CHUNK_SIZE
  const meshes: Mesh[] = [{ indices: new Uint16Array(), vertexes: new Uint8Array() }]
  const rawBlockData = new Uint8Array(world.rawBlockData.length)
  let nonAirBlocksCount = 0
  let nextStateOnNonAirBlocksCount = ((meshes.length / statesCount) * totalNonAirBlocks) | 0
  for (let i = 0, l = rawBlockData.length; i < l; i++) {
    const blockId = (rawBlockData[i] = world.rawBlockData[i]!)
    if (blockId !== AIR_ID) {
      nonAirBlocksCount++
      if (nextStateOnNonAirBlocksCount <= nonAirBlocksCount) {
        const mesh = buildChunkMesh(
          {
            rawBlockData,
            sizeLevel: world.sizeLevel,
          },
          0,
          0,
          chunkSize,
        )
        meshes.push(mesh)
        nextStateOnNonAirBlocksCount = ((meshes.length / statesCount) * totalNonAirBlocks) | 0
      }
    }
  }

  const offset = 0.001
  const offsetX = -chunkSize / 2 + offset + 0.5
  const offsetZ = -chunkSize / 2 + offset + 0.5

  for (const mesh of meshes) moveChunkMesh(mesh, offsetX, offset, offsetZ)

  return meshes.reverse()
}

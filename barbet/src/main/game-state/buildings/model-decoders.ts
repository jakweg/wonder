import { ArrayEncodingType, setArrayEncodingType } from '../../util/persistance/serializers'
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
  const chunkSize = Math.max(world.size.sizeX, world.size.sizeZ)
  const meshes: Mesh[] = [{ indices: new Uint32Array(), vertexes: new Float32Array() }]
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
            size: world.size,
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
  let offsetX = -world.size.sizeX / 2 + offset + 0.5
  let offsetZ = -world.size.sizeZ / 2 + offset + 0.5

  for (const mesh of meshes) moveChunkMesh(mesh, offsetX, offset, offsetZ)

  return meshes.reverse()
}

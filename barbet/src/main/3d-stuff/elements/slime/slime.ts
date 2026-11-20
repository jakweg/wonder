import { NewRenderingPipelineElementCreator } from '@3d/new-render-context'
import EntityId, { INVALID_ENTITY_ID } from '@game/new-entities/id'
// import { spec } from './shaders'

export default (({ pipeline: { visibility }, globals, game, scheduler }) => {
  // const implementation = globals.createGpuResources(spec)

  const impl = globals.createGpuResources({
    programs: {
      defaultSlime: {
        fragmentMain: a => ``,
        fragmentFinalColor: 'vec4(1.0, 0.0, 0.0, 0.0)',

        vertexMain: a => ``,
        vertexFinalPosition: `vec3(0.0,0.0,0.0)`,
      },
    },
  })

  return {
    updateWorldSync() {
      game.entities2.getPosition(INVALID_ENTITY_ID)

      console.log('slime', impl)
    },
    uploadToGpu() {},
    draw() {},
  }
}) satisfies NewRenderingPipelineElementCreator

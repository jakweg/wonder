import terrain from '@3d/elements/terrain/terrain'
import { NewRenderingPipelineElementCreator } from '@3d/new-render-context'

export const createElements = (args: Parameters<NewRenderingPipelineElementCreator>[0]) => {
  return [terrain(args)] satisfies ReturnType<NewRenderingPipelineElementCreator>[]
}

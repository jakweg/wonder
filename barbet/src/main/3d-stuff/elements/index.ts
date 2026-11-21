import slime from '@3d/elements/slime/slime'
import steve from '@3d/elements/steve/steve'
import terrain from '@3d/elements/terrain/terrain'
import { NewRenderingPipelineElementCreator } from '@3d/new-render-context'

export const createElements = (args: Parameters<NewRenderingPipelineElementCreator>[0]) => {
  return [terrain(args), slime(args), steve(args)] satisfies ReturnType<NewRenderingPipelineElementCreator>[]
}

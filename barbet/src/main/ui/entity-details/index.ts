import {
  entityId_asUint32,
  entityId_extractGeneration,
  entityId_extractIndex,
  entityId_extractKind,
} from 'src/main/game-state/new-entities/id'
import CanvasBackground from 'src/main/ui/canvas-background'
import { decodeHoveredEntityIdOrBlock, FrontendVariable, HoveredTargetType } from 'src/main/util/frontend-variables'
import { intervalProducer, map } from 'src/main/util/state/subject'
import { createElement } from '../utils'

export default (parent: HTMLElement, canvas: ReturnType<typeof CanvasBackground>) => {
  const root = createElement('div', parent, '_css_entity-details')

  const text = createElement('span', root)
  text['textContent'] = 'Entity details'

  const rawHovered = intervalProducer(
    () => Atomics.load(canvas.getFrontendVariables(), FrontendVariable.HoveredEntityIdOrBlock),
    50,
  )
  const hovered = map(rawHovered, raw => decodeHoveredEntityIdOrBlock(raw))

  hovered.on(value => {
    let finalText = ''
    switch (value.type) {
      case HoveredTargetType.None:
        finalText = ``
        break
      case HoveredTargetType.Block:
        finalText = `Block { ${value.x}, ${value.z} }`
        break
      case HoveredTargetType.Entity:
        finalText = `Hovered entity: 
id: 0x${entityId_asUint32(value.entityId).toString(16)}
kind: ${entityId_extractKind(value.entityId)}
generation: ${entityId_extractGeneration(value.entityId) & 0b111_1111}
index: ${entityId_extractIndex(value.entityId)}`
        break
    }
    text['textContent'] = finalText
  })
}

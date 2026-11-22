import { createSkeletalEntityElement } from '@3d/skeletal/element'
import { EntityKind } from '@game/new-entities/kind'
import { steveShader } from './shaders'

export default createSkeletalEntityElement({
  kind: EntityKind.Steve,
  shader: steveShader,
  writeExtraInstanceAttributes(entityId, { game, u32, baseUint32, elementOffsets }) {
    u32[baseUint32 + elementOffsets.appearance] = game.entities2.getSteveAppearanceRaw(entityId)
  },
})

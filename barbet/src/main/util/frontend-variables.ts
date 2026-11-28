import EntityId from '@game/new-entities/id'

export const enum PressedKey {
  None = 0,
  Left = 1 << 1,
  Right = 1 << 2,
  Forward = 1 << 3,
  Backward = 1 << 4,
  Up = 1 << 5,
  Down = 1 << 6,
}

export const enum AdditionalFrontedFlags {
  WindowHasFocus = 1 << 0,
}

export const enum FrontendVariable {
  PressedKeys,
  MouseCursorPositionX,
  MouseCursorPositionY,
  MouseWheelDelta,
  /** Delta multiplied by 8 */
  CameraOrbitDeltaX8,
  /** Delta multiplied by 8 */
  CameraOrbitDeltaY8,
  /** Delta multiplied by 8 */
  CameraPanDeltaX8,
  /** Delta multiplied by 8 */
  CameraPanDeltaY8,
  AdditionalFlags,
  CanvasDrawingWidth,
  CanvasDrawingHeight,
  /**
   * Raw 32-bit value from the GPU `R32UI` entity-ID attachment under the cursor.
   * Decode with {@link decodeHoveredEntityIdOrBlock} or {@link readHoveredEntityIdOrBlock}.
   *
   * Bit layout:
   * - `0`: nothing hovered (void/sky or cursor outside canvas)
   * - bit 31 = `1`: terrain block — `[31: 1][30..28: direction][27..14: blockX][13..0: blockZ]`
   * - bit 31 = `0` (non-zero): `EntityId` — decode via `entityId_extractKind`,
   *   `entityId_extractGeneration`, and `entityId_extractIndex` in `@game/new-entities/id`
   */
  HoveredEntityIdOrBlock,
  SIZE,
}

export const enum HoveredTargetType {
  None,
  Block,
  Entity,
}

export type HoveredTarget =
  | { type: HoveredTargetType.None }
  | { type: HoveredTargetType.Block; x: number; z: number }
  | { type: HoveredTargetType.Entity; entityId: EntityId }

const TERRAIN_POSITION_MASK = 0b11_1111_1111_1111 // 14-bit X/Z coordinates (0..16383)

/**
 * Decodes the raw 32-bit value stored in `FrontendVariable.HoveredEntityIdOrBlock`.
 *
 * - `0` -> `HoveredTargetType.None`
 * - `(raw >>> 31) === 1` -> `HoveredTargetType.Block` with `x = (raw >>> 14) & 0b11_1111_1111_1111`, `z = raw & 0b11_1111_1111_1111`
 * - otherwise -> `HoveredTargetType.Entity` whose `entityId` works with `entityId_extractKind` /
 *   `entityId_extractGeneration` / `entityId_extractIndex` from `@game/new-entities/id`
 */
export const decodeHoveredEntityIdOrBlock = (raw: number): HoveredTarget => {
  const unsigned = raw >>> 0
  if (unsigned === 0) return { type: HoveredTargetType.None }

  if (unsigned >>> 31 === 1) {
    return {
      type: HoveredTargetType.Block,
      x: (unsigned >>> 14) & TERRAIN_POSITION_MASK,
      z: unsigned & TERRAIN_POSITION_MASK,
    }
  }

  return {
    type: HoveredTargetType.Entity,
    entityId: unsigned as unknown as EntityId,
  }
}

export const readHoveredEntityIdOrBlock = (frontendVariables: Int32Array): HoveredTarget =>
  decodeHoveredEntityIdOrBlock(Atomics.load(frontendVariables, FrontendVariable.HoveredEntityIdOrBlock))

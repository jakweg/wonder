export const enum EntityKind {
  /** Represents invalid entity kind, should never be used */
  Invalid = 0,
  /** Represents primitive slime entity, for debug and development */
  Slime,

  SIZE,
}

/**
 * Returns how much space to reserve for entities of such kind
 */
export const getMaxEntitiesByKind = (kind: EntityKind) => {
  switch (kind) {
    case EntityKind.Slime:
      return 100
    default:
      return 0
  }
}

/**
 * Returns how much space to reserve for entities of such kind
 */
export const calculateOffsetsForEntityKinds = (
  allowedKinds: readonly EntityKind[],
): Readonly<{ [key in EntityKind]: number }> => {
  const offsetsArray: number[] = []

  let offsetSoFar = 0
  for (let i = 0; i <= EntityKind.SIZE; ++i) {
    offsetsArray.push(offsetSoFar)

    if (allowedKinds.includes(i)) {
      const max = getMaxEntitiesByKind(i)
      offsetSoFar += max
    }
  }

  return offsetsArray as any
}

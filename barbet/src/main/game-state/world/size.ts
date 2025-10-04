export const GENERIC_CHUNK_SIZE = 32
export const MAX_WORLD_HEIGHT = 256

// number of GENERIC_CHUNK_SIZE chunks per single dimension
export const enum WorldSizeLevel {
  SuperTiny = 1,
  Tiny = 4,
  Medium = 16,
  Large = 64,
  ExtraLarge = 128,
  Default = Medium,
}

/* @__PURE__ */ console.assert(
  WorldSizeLevel.ExtraLarge * GENERIC_CHUNK_SIZE <= 2 ** 15,
  'World exceeds technical limits',
)

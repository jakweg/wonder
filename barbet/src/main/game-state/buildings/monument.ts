import lazy from '@seampan/lazy'
import { BuildingMask, BuildingMesh, BuildingProgressInfo } from '.'
import { decodeVertexesAndIndices } from './model-decoders'

const data = { 'sizes': [3, 3, 3], 'blocks': 'BwcHBwMHBwcHAAAAAAcAAAAAAAAAAAcAAAAA' }

export const getMask = (): Readonly<BuildingMask> => ({ sizeX: 3, sizeZ: 3 })

export const getProgressInfo = (): Readonly<BuildingProgressInfo> => ({ pointsToFullyBuild: 11 })

const decoded = /* @__PURE__ */ lazy(() => decodeVertexesAndIndices(data, 11))

export const getModel = (): Readonly<BuildingMesh> => decoded()

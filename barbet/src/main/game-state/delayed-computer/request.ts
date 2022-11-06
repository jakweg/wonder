import { ItemType } from '../items'

export const enum RequestType {
  FindPath,
  FindItem,
}

export interface PathRequest {
  readonly type: RequestType.FindPath
  readonly startX: number
  readonly startZ: number
  readonly destinationXCenter: number
  readonly destinationZCenter: number
  readonly destinationXMin: number
  readonly destinationXMax: number
  readonly destinationZMin: number
  readonly destinationZMax: number
}

export interface ItemRequest {
  readonly type: RequestType.FindItem
  readonly searchCenterX: number
  readonly searchCenterZ: number
  readonly filterType: ItemType
}

export type Request = { readonly id: number } & (PathRequest | ItemRequest)

export const encode = (req: Request, destination: Int32Array, offset: number): number => {
  const initialOffset = offset

  destination[offset++] = req.id
  destination[offset++] = req.type
  switch (req.type) {
    case RequestType.FindPath: {
      destination[offset++] = req.startX
      destination[offset++] = req.startZ
      destination[offset++] = req.destinationXCenter
      destination[offset++] = req.destinationZCenter
      destination[offset++] = req.destinationXMin
      destination[offset++] = req.destinationXMax
      destination[offset++] = req.destinationZMin
      destination[offset++] = req.destinationZMax
      break
    }
    case RequestType.FindItem: {
      destination[offset++] = req.searchCenterX
      destination[offset++] = req.searchCenterZ
      destination[offset++] = req.filterType
      break
    }
  }
  return offset - initialOffset
}

export const decode = (source: Int32Array, offset: number): [Request, number] => {
  const initialOffset = offset
  let object: Request
  const id = source[offset++]!
  const type = source[offset++]!

  switch (type) {
    case RequestType.FindPath: {
      object = {
        id,
        type,
        startX: source[offset++]!,
        startZ: source[offset++]!,
        destinationXCenter: source[offset++]!,
        destinationZCenter: source[offset++]!,
        destinationXMin: source[offset++]!,
        destinationXMax: source[offset++]!,
        destinationZMin: source[offset++]!,
        destinationZMax: source[offset++]!,
      }
      break
    }
    case RequestType.FindItem: {
      object = {
        id,
        type,
        searchCenterX: source[offset++]!,
        searchCenterZ: source[offset++]!,
        filterType: source[offset++]!,
      }
      break
    }
    default:
      throw new Error()
  }
  return [object, offset - initialOffset]
}

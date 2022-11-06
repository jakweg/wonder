import { FORCE_ENV_ZERO } from './build-info'

export const sharedMemoryIsAvailable =
  !FORCE_ENV_ZERO && (!!location.reload ? !!window.SharedArrayBuffer : !!self.SharedArrayBuffer)

const constructor = sharedMemoryIsAvailable ? SharedArrayBuffer : ArrayBuffer
export const createNewBuffer = (byteLength: number): SharedArrayBuffer => {
  return new constructor(byteLength) as any
}

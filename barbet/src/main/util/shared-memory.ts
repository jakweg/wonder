export const sharedMemoryIsAvailable = !!location.reload ? !!window.SharedArrayBuffer : !!self.SharedArrayBuffer

const constructor = sharedMemoryIsAvailable ? SharedArrayBuffer : ArrayBuffer
export const createNewBuffer = (byteLength: number): SharedArrayBuffer => {
  return new constructor(byteLength) as any
}

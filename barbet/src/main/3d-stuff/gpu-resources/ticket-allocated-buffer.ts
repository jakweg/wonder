import TypedArray from '@seampan/typed-array'

interface Block {
  offset: number
  size: number
}

export interface TicketAllocatedBuffer {
  /**
   * Allocates space within a buffer and puts `content` inside of it.
   * If the buffer is too small it automatically reallocates it to fit the existing content as well as `content`.
   * It does not preserve any data on CPU side and does not hold reference to `content`.
   * If `currentOffset` is not `-1` then it first deallocates memory at this location and then precedes as normal.
   */
  replaceContent(currentOffset: number | -1, content: ArrayBufferLike | TypedArray): number
}

export const createTicketAllocatedBuffer = (
  gl: WebGL2RenderingContext,
  glBuffer: WebGLBuffer,
  target: any,
  usage: any,
  initialBytesCapacity?: number,
): TicketAllocatedBuffer => {
  let currentCapacity = initialBytesCapacity ?? 8 * 1024 * 1024
  gl.bindBuffer(target, glBuffer)
  gl.bufferData(target, currentCapacity, usage)
  gl.bindBuffer(target, null)

  // key is offset, value is size
  const allocatedBlocks = new Map<number, number>()
  const freeBlocks: Block[] = [{ offset: 0, size: currentCapacity }]

  return {
    replaceContent(currentOffset, content) {
      const contentSize = content.byteLength

      // deallocation of previous memory block
      if (currentOffset >= 0) {
        let indexToInsertBlock = 0
        for (const b of freeBlocks) {
          if (b.offset > currentOffset) break
          indexToInsertBlock++
        }
        const sizeOfDeallocatedBlock = allocatedBlocks.get(currentOffset)
        if (!sizeOfDeallocatedBlock) throw new Error()
        allocatedBlocks.delete(currentOffset)

        const previousBlock = freeBlocks[indexToInsertBlock - 1]
        const nextBlock = freeBlocks[indexToInsertBlock]

        // try to merge with the one of the left
        if (previousBlock !== undefined && previousBlock.offset + previousBlock.size === currentOffset) {
          // increase the size of free block at left instead of creating a new block since they touch each other
          previousBlock.size += sizeOfDeallocatedBlock

          if (nextBlock !== undefined && nextBlock.offset === previousBlock.offset + previousBlock.size) {
            // looks like we can merge previous with next
            previousBlock.size += nextBlock.size
            freeBlocks.splice(indexToInsertBlock, 1)
          }

          // try to merge with the one of the right
        } else if (nextBlock !== undefined && nextBlock.offset === currentOffset + sizeOfDeallocatedBlock) {
          // increase the size of free block at right instead of creating a new block since they touch each other
          nextBlock.offset -= sizeOfDeallocatedBlock
          nextBlock.size += sizeOfDeallocatedBlock
        } else {
          // if didn't merge with any that means we need to create new one
          freeBlocks.splice(indexToInsertBlock, 0, {
            offset: currentOffset,
            size: sizeOfDeallocatedBlock,
          })
        }
      }

      let availableFreeBlockIndex = freeBlocks.findIndex(b => b.size >= contentSize)
      // resizing existing buffer
      if (availableFreeBlockIndex < 0) {
        const newCapacity = Math.ceil((currentCapacity + contentSize) / currentCapacity) * currentCapacity
        // console.warn('Resizing gpu buffer', currentCapacity, '=>', newCapacity)
        const temporaryBuffer = gl.createBuffer()
        gl.bindBuffer(gl.COPY_READ_BUFFER, glBuffer)
        gl.bindBuffer(gl.COPY_WRITE_BUFFER, temporaryBuffer)
        gl.bufferData(gl.COPY_WRITE_BUFFER, newCapacity, gl.STATIC_DRAW)
        gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.COPY_WRITE_BUFFER, 0, 0, currentCapacity)

        gl.bufferData(gl.COPY_READ_BUFFER, newCapacity, usage)

        gl.bindBuffer(gl.COPY_READ_BUFFER, temporaryBuffer)
        gl.bindBuffer(gl.COPY_WRITE_BUFFER, glBuffer)
        gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.COPY_WRITE_BUFFER, 0, 0, currentCapacity)

        gl.bindBuffer(gl.COPY_READ_BUFFER, null)
        gl.bindBuffer(gl.COPY_WRITE_BUFFER, null)

        gl.deleteBuffer(temporaryBuffer)

        const lastFreeBlock = freeBlocks.at(-1)
        if (lastFreeBlock) {
          lastFreeBlock.size += newCapacity - currentCapacity
        } else {
          freeBlocks.push({
            offset: currentCapacity,
            size: newCapacity - currentCapacity,
          })
        }
        currentCapacity = newCapacity
        // last block is big enough for sure
        availableFreeBlockIndex = freeBlocks.length - 1
      }

      // allocation of memory block
      const availableBlock = freeBlocks[availableFreeBlockIndex]!
      const finalOffset = availableBlock.offset
      if (availableBlock.size === contentSize) {
        freeBlocks.splice(availableFreeBlockIndex, 1)
      } else {
        // if available block is larger then move it right
        availableBlock.offset += contentSize
        availableBlock.size -= contentSize
      }

      // finally uploading data
      gl.bindBuffer(target, glBuffer)
      gl.bufferSubData(target, finalOffset, content)
      gl.bindBuffer(target, null)

      return finalOffset
    },
  }
}

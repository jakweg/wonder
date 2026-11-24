import { createNewBuffer } from './shared-memory'

type WaitAsyncResult = {
  async: boolean
  value: Promise<'ok' | 'not-equal' | 'timed-out'>
}

export const isInWorker = !location.reload

export type GameMutex = {
  enterForUpdate(): void
  enterForUpdateAsync(): Promise<void>
  exitUpdate(): void
  tryEnterForRender(timeoutMs: number): boolean
  tryEnterForRenderAsync(timeoutMs: number): Promise<boolean>
  exitRender(): void
  enterForRenderHelper(id: number): void
  exitRenderHelper(id: number): void
  pass(): any
}

const UPDATE_BIT = 0b1 << 0
const RENDER_BIT = 0b1 << 1
const RENDER_HELPER_BIT = 0b1 << 2

export const createNewGameMutex = (): GameMutex => {
  return gameMutexFrom(createNewBuffer(Int32Array.BYTES_PER_ELEMENT))
}

export const gameMutexFrom = (data: any): GameMutex => {
  const array = new Int32Array(data)

  return {
    enterForUpdate(): void {
      const thisValue = Atomics.or(array, 0, UPDATE_BIT) | UPDATE_BIT
      Atomics.notify(array, 0)
      if (thisValue === UPDATE_BIT) {
        // success: only update thread has the lock
        return
      }
      // looks like we need to wait for exclusivity
      while (true) {
        Atomics.wait(array, 0, thisValue)

        if (Atomics.load(array, 0) === UPDATE_BIT) return // success: now we have exclusivity
      }
    },
    async enterForUpdateAsync(): Promise<void> {
      const thisValue = Atomics.or(array, 0, UPDATE_BIT) | UPDATE_BIT
      Atomics.notify(array, 0)
      if (thisValue === UPDATE_BIT) {
        // success: only update thread has the lock
        return
      }
      // looks like we need to wait for exclusivity
      while (true) {
        await Atomics.waitAsync(array, 0, thisValue as any)['value']

        if (Atomics.load(array, 0) === UPDATE_BIT) return // success: now we have exclusivity
      }
    },
    exitUpdate(): void {
      Atomics.and(array, 0, ~UPDATE_BIT)
      Atomics.notify(array, 0)
    },
    tryEnterForRender(timeoutMs: number): boolean {
      const deadline = performance.now() + timeoutMs
      while (true) {
        const value = Atomics.load(array, 0)
        if ((value & UPDATE_BIT) === 0) {
          const replaced = Atomics.compareExchange(array, 0, value, value | RENDER_BIT)
          if (replaced === value) {
            Atomics.notify(array, 0)
            return true
          }
          continue
        }
        const remaining = deadline - performance.now()
        if (remaining <= 0) return false
        Atomics.wait(array, 0, value, remaining)
      }
    },
    async tryEnterForRenderAsync(timeoutMs: number): Promise<boolean> {
      const deadline = performance.now() + timeoutMs
      while (true) {
        const value = Atomics.load(array, 0)
        if ((value & UPDATE_BIT) === 0) {
          const replaced = Atomics.compareExchange(array, 0, value, value | RENDER_BIT)
          if (replaced === value) {
            Atomics.notify(array, 0)
            return true
          }
          continue
        }
        const remaining = deadline - performance.now()
        if (remaining <= 0) return false
        await Atomics.waitAsync(array, 0, value as any, remaining)['value']
      }
    },
    exitRender(): void {
      Atomics.and(array, 0, ~RENDER_BIT)
      Atomics.notify(array, 0)
    },
    enterForRenderHelper(id: number): void {
      const bit = RENDER_HELPER_BIT << id

      while (true) {
        const value = Atomics.load(array, 0)
        if ((value & UPDATE_BIT) === 0) {
          // try acquire as update doesn't want that
          const replaced = Atomics.compareExchange(array, 0, value, value | bit)
          if (replaced === value && (replaced & UPDATE_BIT) === 0) {
            Atomics.notify(array, 0)
            return // success, we have the lock!}
          }
        }
        // update is happening right now, wait for it to finish
        Atomics.wait(array, 0, value)
      }
    },
    exitRenderHelper(id: number): void {
      const bit = RENDER_HELPER_BIT << id

      Atomics.and(array, 0, ~bit)
      Atomics.notify(array, 0)
    },
    pass() {
      return array['buffer']
    },
  }
}

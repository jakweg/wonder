import { isInWorker } from '../game-mutex'
import { createNewBuffer } from '../shared-memory'

const getStorage = <T extends 'localStorage' | 'sessionStorage'>(name: T) => {
  try {
    const storage = window[name]
    storage['getItem']('-')
    return {
      setItem(name: string, value: string) {
        return void storage['setItem'](name, value)
      },
      getItem(name: string): string | null {
        return storage['getItem'](name)
      },
      removeItem(name: string) {
        return void storage['removeItem'](name)
      },
    }
  } catch (e) {
    // cookies blocked
  }

  const storage = new Map<string, string>()
  return {
    setItem(name: string, value: string) {
      return void storage['set'](name, value)
    },
    getItem(name: string): string | null {
      return storage['get'](name) ?? null
    },
    removeItem(name: string) {
      return void storage['delete'](name)
    },
  }
}

const localStorage = /* @__PURE__ */ getStorage('localStorage')

export const getFromLocalStorage = (key: string): any => {
  const item = localStorage.getItem(key)
  if (item != null) {
    try {
      return JSON.parse(item)
    } catch (e) {
      console.error(`Parse error of saved item key=${key}`)
      localStorage.removeItem(key)
    }
  }
  return undefined
}

export const putInLocalStorage = (key: string, value: any): void => {
  localStorage.setItem(key, JSON.stringify(value))
}

let cameraBuffer: SharedArrayBuffer | null = null
export const getCameraBuffer = () => {
  if (cameraBuffer === null) {
    let array = getFromLocalStorage('camera/buffer')
    if (array == undefined || array.length !== 6)
      array = [
        14.723411560058594, 8.757417678833008, 2.952042818069458, 12.62341022491455, 4.75743293762207,
        5.952143669128418,
      ]
    cameraBuffer = createNewBuffer(6 * Float32Array.BYTES_PER_ELEMENT)
    const tmp = new Float32Array(cameraBuffer)
    for (let i = 0; i < 6; i++) tmp[i] = array[i]!
  }
  return cameraBuffer
}
export const setCameraBuffer = (buffer: SharedArrayBuffer) => {
  cameraBuffer = buffer
}

export const save = () => {
  if (isInWorker) throw new Error('Attempt to save storage in worker')
  putInLocalStorage('camera/buffer', [...new Float32Array(getCameraBuffer())])
}

let saveCallbacks: any[] = []
export const addSaveCallback = (callback: () => any) => {
  saveCallbacks.push(callback)
}

export const registerSaveSettingsCallback = () => {
  window.addEventListener('beforeunload', () => {
    for (let i = 0, l = saveCallbacks.length; i < l; i++) {
      const result = saveCallbacks[i]()
      if (result != null) for (const entry of Object.entries(result)) putInLocalStorage(entry[0], entry[1])
    }
    save()
  })
}

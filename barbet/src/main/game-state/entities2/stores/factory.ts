import { ArrayEncodingType, encodeArray, setArrayEncodingType } from '@utils/persistance/serializers'
import { createNewBuffer } from '@utils/shared-memory'

export default class StoreFactory {
  private usedNames: string[] = []
  private constructor(
    private readonly isBrandNew: boolean,
    private readonly buffersByName: { [key: string]: ArrayBuffer },
  ) {}

  public static createNew() {
    return new StoreFactory(true, {})
  }

  public static fromReceived(object: any) {
    return new StoreFactory(false, object)
  }
  public pass(): unknown {
    return this.buffersByName
  }

  public static deserialize(object: any) {
    return new StoreFactory(false, object)
  }
  public serialize(): unknown {
    throw new Error('not implemented')
    return this.buffersByName
  }

  getBufferForStore(name: string, sizeInBytes: number) {
    if (this.usedNames['includes'](name)) throw new Error()
    if (this.isBrandNew) {
      const buffer = createNewBuffer(sizeInBytes)

      this.usedNames.push(name)
      this.buffersByName[name] = buffer

      return buffer
    } else {
      const buffer = this.buffersByName[name] as ArrayBuffer
      if (buffer['byteLength'] !== sizeInBytes) throw new Error()

      this.usedNames.push(name)

      return buffer
    }
  }
}

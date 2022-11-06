import { GameState } from '@game'
import { decodeArray, encodeArray } from '@utils/persistance/serializers'
import handleItemRequest from './handlers/item'
import handlePathRequest from './handlers/path'
import { decode as decodeRequest, encode as encodeRequest, Request, RequestType } from './request'
import { decode as decodeResult, encode as encodeResult, Result } from './result'

export interface DelayedComputer {
  tick(game: GameState): void

  serialize(): unknown

  request(request: Request): number

  getResult(requestId: number): Result | null
}

class DelayedComputerImpl implements DelayedComputer {
  constructor(
    private nextRequestId: number,
    private readonly requestsQueue: Request[],
    private readonly results: Map<number, Result>,
  ) {}

  public request(request: Request): number {
    const id = this.nextRequestId++
    this.requestsQueue.push({ ...request, id })
    return id
  }

  public getResult(requestId: number): Result | null {
    return this.results.get(requestId) ?? null
  }

  public tick(game: GameState): void {
    this.deleteOldResults(game)
    this.processSomeRequests(game)
  }

  public serialize(): unknown {
    let index = 1
    const requestsArray: number[] = []
    requestsArray.push(this.requestsQueue.length)
    for (const item of this.requestsQueue) index += encodeRequest(item, requestsArray as unknown as Int32Array, index)

    index = 1
    const resultsArray: number[] = []
    requestsArray.push(this.results.size)
    for (const item of this.results.values()) index += encodeResult(item, resultsArray as unknown as Int32Array, index)

    return {
      'nextRequestId': this.nextRequestId,
      'requestsQueue': encodeArray(new Int32Array(requestsArray)),
      'results': encodeArray(new Int32Array(resultsArray)),
    }
  }

  private deleteOldResults(game: GameState) {
    const now = game.currentTick
    const clearOlderThen = now - 20 * 60 * 2
    for (const [key, value] of [...this.results.entries()]) {
      if (value.computedAt < clearOlderThen) this.results.delete(key)
    }
  }

  private processSomeRequests(game: GameState) {
    const now = game.currentTick
    const requestsCount = this.requestsQueue.length
    for (let i = 0; i < requestsCount; i++) {
      const request = this.requestsQueue.shift()!

      let result: any
      switch (request.type) {
        case RequestType.FindPath:
          result = handlePathRequest(request, game)
          break
        case RequestType.FindItem:
          result = handleItemRequest(request, game)
          break
        default:
          throw new Error()
      }
      this.results.set(request.id, { ...result, id: request.id, computedAt: now })
    }
  }
}

export const createNewDelayedComputer = (): DelayedComputer => {
  return new DelayedComputerImpl(1, [], new Map<number, Result>())
}

export const deserializeDelayedComputer = (object: any): DelayedComputer => {
  const requests: Request[] = []
  const requestsQueue = decodeArray(object['requestsQueue'], false, Int32Array)
  let length = requestsQueue[0]!
  let offset = 1
  for (let i = 0; i < length; i++) {
    const [req, o] = decodeRequest(requestsQueue, offset)
    offset += o
    requests.push(req)
  }

  const results = new Map<number, Result>()
  const resultsArray = decodeArray(object['results'], false, Int32Array)
  length = resultsArray[0]!
  offset = 1
  for (let i = 0; i < length; i++) {
    const [res, o] = decodeResult(requestsQueue, offset)
    offset += o
    results.set(res.id, res)
  }

  return new DelayedComputerImpl(object['nextRequestId'], requests, results)
}

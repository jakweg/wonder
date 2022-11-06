export interface SystemMessageTypeToWorker {
  'set-global-mutex': { mutex: unknown }
}

export interface SystemMessageTypeFromWorker {
  'connection-established': { now: number }
}

import State from '.'
import IndexedState from './indexed-state'

type Setter<T> = (setter: (previous: T | undefined) => T) => void

export interface Subject<T> {
  value(): T | undefined

  on(callback: (value: T, previous: T | undefined) => void, ignoreFirstCall?: boolean): () => void
}

export const newSubject = <T>(defaultValue: T | undefined = undefined): [Subject<T>, Setter<T>] => {
  return constructSubject({
    defaultValue,
    start: () => void 0,
    end: () => void 0,
  })
}

const constructSubject = <T>(params: {
  defaultValue: T | undefined
  start: (set: Setter<T | undefined>) => void
  end: () => void
}): [Subject<T>, Setter<T>] => {
  let currentValue: T | undefined = params.defaultValue
  let listeners: any[] = []

  const valueSetter = (producer: (old: T | undefined) => T) => {
    const newValue = producer(currentValue)
    if (newValue === currentValue) return
    const oldValue = currentValue
    currentValue = newValue
    for (const l of listeners) l(newValue, oldValue)
  }

  const subject: Subject<T> = {
    value() {
      return currentValue
    },
    on(callback, ignoreFirstCall) {
      if (listeners.length === 0) params.start(valueSetter)

      const newCallback = callback['bind'](null)
      listeners.push(newCallback)

      if (!ignoreFirstCall) newCallback(currentValue)

      return () => {
        const index = listeners.indexOf(newCallback)
        if (index >= 0) {
          listeners.splice(index, 1)
          if (listeners.length === 0) params.end()
        }
      }
    },
  }

  return [subject, valueSetter]
}

export const map = <T, U>(source: Subject<T>, transform: (value: T) => U): Subject<U> => {
  let cancel: any = null
  return constructSubject({
    defaultValue: undefined as any as U,
    start(set) {
      cancel = source.on(v => set(() => transform(v)))
    },
    end() {
      cancel?.()
    },
  })[0]!
}

export const reduce = <T, U>(
  sources: ReadonlyArray<Subject<T>>,
  transform: (value: T, accumulator: U) => U,
  start: U,
): Subject<U> => {
  let cancel: any[] = []
  let values: any[] = []
  let updateAnimation: any = null
  return constructSubject({
    defaultValue: undefined as any as U,
    start(set) {
      cancel = sources.map((s, i) => {
        s.on(v => {
          values[i] = v
          cancelAnimationFrame(updateAnimation)
          updateAnimation = requestAnimationFrame(() => {
            const total = values['reduce'](transform, start)
            set(() => total)
          })
        })
      })
    },
    end() {
      cancel.forEach(c => c())
    },
  })[0]!
}

export const intervalProducer = <T>(value: () => T, interval: number): Subject<T> => {
  let cancelTimeout: any = null
  let cancelAnimation: any = null

  const schedule = (set: Setter<T | undefined>) =>
    (cancelTimeout = setTimeout(() => {
      cancelAnimation = requestAnimationFrame(() => {
        set(() => value())
        schedule(set)
      })
    }, interval))
  return constructSubject({
    defaultValue: value(),
    start(set) {
      schedule(set)
    },
    end() {
      clearTimeout(cancelTimeout)
      cancelAnimationFrame(cancelAnimation)
    },
  })[0]!
}

export const observeField = <S, K extends keyof S>(
  state: State<S> | IndexedState<S>,
  key: K,
): Subject<Readonly<S[K]>> => {
  let cancel: any = null
  return constructSubject({
    defaultValue: state.get(key),
    start(set) {
      cancel = state.observe(key, value => set(() => value))
    },
    end() {
      cancel?.()
    },
  })[0]!
}

export const constant = <T>(value: T) => newSubject(value)[0]!

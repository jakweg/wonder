export default class IndexedState<T> {
    private everythingObservers: ((value: any) => void)[] = []
    private constructor(
        private readonly values: any[],
        private readonly fieldObservers: ((value: any) => void)[][],
    ) { }

    public static fromObject<T>(initial: T): IndexedState<T> {
        const keys = Object['keys'](initial as any)
        const size = keys['length']

        const values: any[] = new Array(size)
        for (let i = 0; i < size; i++) {
            values[Number(keys[i])] = (initial as any)[keys[i]!] as any
        }

        const listeners = [...new Array(size)].map(() => []);
        return new IndexedState(values, listeners)
    }

    public get<K extends keyof T>(key: K): Readonly<T[K]> {
        return this.values[key as any] as any
    }


    public set<
        K1 extends keyof T,
        K2 extends keyof T,
        K3 extends keyof T,
        K4 extends keyof T,
        K5 extends keyof T,
    >(
        key1: K1, value1: T[K1],
        key2?: K2, value2?: T[K2],
        key3?: K3, value3?: T[K3],
        key4?: K4, value4?: T[K4],
        key5?: K5, value5?: T[K5],
    ): void {
        let anyChanged = this.singleChange(key1, value1)

        if (key2 !== undefined && this.singleChange(key2, value2))
            anyChanged = true
        if (key3 !== undefined && this.singleChange(key3, value3))
            anyChanged = true
        if (key4 !== undefined && this.singleChange(key4, value4))
            anyChanged = true
        if (key5 !== undefined && this.singleChange(key5, value5))
            anyChanged = true

        if (anyChanged || this.everythingObservers['length'] > 0) {
            const pass = this.pass()
            this.everythingObservers['forEach'](e => e(pass))
        }
    }

    private singleChange(key: any, value: any): boolean {
        if (this.values[key as any] === value) return false
        this.values[key as any] = value
        this.fieldObservers[key as any]?.['forEach'](e => e(value))
        return true
    }

    public observe<K extends keyof T>(key: K,
        callback: ((value: T[K]) => void),
        initialCall: boolean = true): () => void {

        let listeners = this.fieldObservers[key as any]
        if (listeners === undefined)
            this.fieldObservers[key as any] = listeners = []

        const newCallback = (value: any) => {
            callback(value)
        }
        listeners['push'](newCallback)

        if (initialCall)
            callback(this.values[key as any])

        return () => {
            const index = listeners!['indexOf'](newCallback)
            if (index >= 0)
                listeners!['splice'](index, 1)
        }
    }

    public pass(): unknown {
        return this.values
    }

    public observeEverything(
        callback: ((value: any) => void),
        initialCall: boolean = true): () => void {
        const newCallback = (value: any) => {
            callback(value)
        }
        this.everythingObservers['push'](newCallback)


        if (initialCall)
            callback(this.pass())

        return () => {
            const index = this.everythingObservers!['indexOf'](newCallback)
            if (index >= 0)
                this.everythingObservers!['splice'](index, 1)
        }
    }

    public replaceFromArray(array: any[]): void {
        const size = array['length']
        let anyChanged = false
        for (let i = 0; i < size; ++i) {
            const value = array[i];
            if (this.values[i] !== value) {
                this.values[i] = value
                this.fieldObservers[i]?.['forEach'](e => e(value))
                anyChanged = true
            }
        }
        if (anyChanged && this.everythingObservers['length'] > 0) {
            const pass = this.pass()
            this.everythingObservers['forEach'](e => e(pass))
        }
    }
}
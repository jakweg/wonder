
export class EventEmitter<EventsMap>{
    private eventListeners = new Map<keyof EventsMap, Set<(extra?: any) => void>>()

    public on<K extends keyof EventsMap>(type: K, callback: (extra: EventsMap[K]) => void) {
        const list = this.eventListeners.get(type)
        if (list) list.add(callback)
        else this.eventListeners.set(type, new Set([callback]))
    }


    protected emit<K extends keyof EventsMap>(type: K, extra: EventsMap[K]) {
        const list = this.eventListeners.get(type)
        if (list)
            for (const listener of list.values())
                listener(extra)
    }

    protected emitAsync<K extends keyof EventsMap>(type: K, extra: EventsMap[K]) {
        setTimeout(() => this.emit(type, extra))
    }
}

export default EventEmitter
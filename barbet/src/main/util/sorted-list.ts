export class SortedList<T> {
	private list: T[] = []

	public constructor(private readonly isFirstLess: (o1: T, o2: T) => boolean) {
	}

	add(obj: T) {
		for (let i = 0; i < this.list.length; i++) {
			if (this.isFirstLess(obj, this.list[i]!)) {
				this.list.splice(i, 0, obj)
				return
			}
		}
		this.list.push(obj)
	}

	has(check: (obj: T) => boolean): boolean {
		return !!this.list.find(check)
	}

	getAndRemoveFirst(): T | undefined {
		return this.list.shift()
	}
}

export default SortedList

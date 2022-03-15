export const openIndexedDatabase = (name: string, version: number,
                                    upgradeCallback: (result: IDBDatabase) => void) => {
	return new Promise<IDBDatabase>((resolve, reject) => {
		const request = indexedDB['open'](name, version)
		request.onblocked = reject
		request.onerror = reject
		request.onsuccess = () => void resolve(request['result'])

		request.onupgradeneeded = () => {
			const db = request['result']
			upgradeCallback(db)
		}
	})
}

export const promiseWrapRequest = <T>(request: IDBRequest<T>) => {
	return new Promise<T>((resolve, reject) => {
		request.onerror = reject
		request.onsuccess = () => resolve(request['result'])
	})
}

export const promiseWrapTransactionCommit = (transaction: IDBTransaction) => {
	return new Promise<void>((resolve, reject) => {
		transaction.onerror = reject
		transaction.onabort = reject
		transaction.oncomplete = () => resolve()
		transaction['commit']()
	})
}

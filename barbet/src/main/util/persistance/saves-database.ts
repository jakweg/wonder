import { openIndexedDatabase, promiseWrapRequest, promiseWrapTransactionCommit } from './indexed-database'

const enum Constants {
	VERSION = 1,
	DB_NAME = 'saves',
	STORE_MAIN_DATA = 'main-data',
}

const createSavesDatabaseCallback = (db: IDBDatabase) => {
	db.createObjectStore(Constants.STORE_MAIN_DATA, {'keyPath': 'id'})
}

export const getSavesList = async (): Promise<string[]> => {
	const db = await openIndexedDatabase(Constants.DB_NAME, Constants.VERSION, createSavesDatabaseCallback)
	const transaction = db.transaction([Constants.STORE_MAIN_DATA as string], 'readonly')
	const data = await promiseWrapRequest(transaction.objectStore(Constants.STORE_MAIN_DATA).getAllKeys(null, 1)) as string[]

	transaction['commit']()
	db['close']()
	return data
}

export const readSaveData = async (id: string): Promise<any> => {
	const db = await openIndexedDatabase(Constants.DB_NAME, Constants.VERSION, createSavesDatabaseCallback)
	const transaction = db.transaction([Constants.STORE_MAIN_DATA as string], 'readonly')
	const data = await promiseWrapRequest(transaction
		.objectStore(Constants.STORE_MAIN_DATA)['get'](IDBKeyRange['only'](id))) as any

	transaction['commit']()
	db['close']()

	return data['data']
}


export const putSaveData = async (id: string, data: any): Promise<void> => {
	const db = await openIndexedDatabase(Constants.DB_NAME, Constants.VERSION, createSavesDatabaseCallback)
	const transaction = db.transaction([Constants.STORE_MAIN_DATA as string], 'readwrite')
	const objectToPut = {'id': id, 'data': data}
	await promiseWrapRequest(transaction
		.objectStore(Constants.STORE_MAIN_DATA)['put'](objectToPut))

	await promiseWrapTransactionCommit(transaction)

	db['close']()
}

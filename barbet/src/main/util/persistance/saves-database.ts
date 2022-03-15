import { openIndexedDatabase, promiseWrapRequest, promiseWrapTransactionCommit } from './indexed-database'

const enum Constants {
	DB_NAME = 'saves',
	STORE_MAIN_DATA = 'main-data',
}

const createSavesDatabaseCallback = (db: IDBDatabase) => {
	db.createObjectStore(Constants.STORE_MAIN_DATA, {keyPath: 'id'})
}

export const getSavesList = async (): Promise<string[]> => {

	const db = await openIndexedDatabase(Constants.DB_NAME, 1, createSavesDatabaseCallback)
	const transaction = db.transaction([Constants.STORE_MAIN_DATA], 'readonly')
	const data = await promiseWrapRequest(transaction.objectStore(Constants.STORE_MAIN_DATA).getAllKeys(null, 1)) as string[]

	transaction.commit()
	db.close()

	return data
}

export const readSaveData = async (id: string): Promise<any> => {
	const db = await openIndexedDatabase(Constants.DB_NAME, 1, createSavesDatabaseCallback)
	const transaction = db.transaction([Constants.STORE_MAIN_DATA], 'readonly')
	const data = await promiseWrapRequest(transaction
		.objectStore(Constants.STORE_MAIN_DATA)
		.get(IDBKeyRange.only(id))) as any

	transaction.commit()
	db.close()

	return data['data']
}


export const putSaveData = async (id: string, data: any): Promise<void> => {
	const db = await openIndexedDatabase(Constants.DB_NAME, 1, createSavesDatabaseCallback)
	const transaction = db.transaction([Constants.STORE_MAIN_DATA], 'readwrite')
	const objectToPut = {'id': id, 'data': data}
	await promiseWrapRequest(transaction
		.objectStore(Constants.STORE_MAIN_DATA)
		.put(objectToPut))

	await promiseWrapTransactionCommit(transaction)
	db.close()
}

import { putSaveData } from '../../util/persistance/saves-database'
import { ArrayEncodingType, setArrayEncodingType } from '../../util/persistance/serializers'
import { GameState, GameStateImplementation } from '../game-state'

export const enum SaveMethod {
	ToIndexedDatabase,
	ToDataUrl,
	ToString,
	ToString2,
}

export type SaveGameArguments = {
	method: SaveMethod.ToDataUrl | SaveMethod.ToIndexedDatabase
	saveName: string
} | {
	method: SaveMethod.ToString,
	forPlayerId: number
	sendPaused: boolean
} | { method: SaveMethod.ToString2 }

export type SaveGameResult =
	| { method: SaveMethod.ToDataUrl, url: string, }
	| { method: SaveMethod.ToIndexedDatabase, }
	| { method: SaveMethod.ToString2, serializedState: string, }


const saveToIndexedDb = async (saveName: string, game: GameState) => {
	setArrayEncodingType(ArrayEncodingType.Array)
	await putSaveData(saveName, (game as GameStateImplementation).serialize())
	setArrayEncodingType(ArrayEncodingType.None)
}

const saveToString = (game: GameState): string => {
	setArrayEncodingType(ArrayEncodingType.String)
	const data = JSON.stringify((game as GameStateImplementation).serialize())
	setArrayEncodingType(ArrayEncodingType.None)

	return data
}

const saveToUrl = (game: GameState) => {
	setArrayEncodingType(ArrayEncodingType.String)
	const asString = JSON.stringify((game as GameStateImplementation).serialize())
	setArrayEncodingType(ArrayEncodingType.None)

	const length = asString.length
	const bytes = new Uint8Array(length)
	for (let i = 0; i < length; i++)
		bytes[i] = asString.charCodeAt(i)!
	return URL.createObjectURL(new Blob([bytes]))
}

export const performGameSave = async (game: GameState,
	saveArgs: SaveGameArguments): Promise<SaveGameResult> => {

	switch (saveArgs.method) {
		case SaveMethod.ToIndexedDatabase:
			await saveToIndexedDb(saveArgs.saveName, game)
			return { method: SaveMethod.ToIndexedDatabase }
		case SaveMethod.ToString:
			throw new Error('unsupported')
		case SaveMethod.ToDataUrl:
			const url = saveToUrl(game)
			return { method: SaveMethod.ToDataUrl, url }
		case SaveMethod.ToString2:
			const string = saveToString(game)
			return { method: SaveMethod.ToString2, serializedState: string }
		default:
			throw new Error()
	}
}

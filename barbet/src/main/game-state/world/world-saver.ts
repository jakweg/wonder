import { FeedbackEvent, SaveGameArguments, SaveMethod } from '../../entry-points/feature-environments/loader'
import { GameState, GameStateImplementation } from '../game-state'
import { putSaveData } from '../../util/persistance/saves-database'
import { ArrayEncodingType, setArrayEncodingType } from '../../util/persistance/serializers'

const saveToIndexedDb = (saveName: string, game: GameState) => {
	setArrayEncodingType(ArrayEncodingType.Array)
	void putSaveData(saveName, (game as GameStateImplementation).serialize())
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

export const performGameSave = (game: GameState | null,
                                saveArgs: SaveGameArguments,
                                feedbackCallback: (value: FeedbackEvent) => void,
                                inputActorIds: number[]) => {
	if (game === null) return

	const saveName = saveArgs.saveName
	switch (saveArgs.method) {
		case SaveMethod.ToIndexedDatabase:
			saveToIndexedDb(saveName, game)
			break
		case SaveMethod.ToString:
			const string = saveToString(game)
			feedbackCallback({
				type: 'saved-to-string',
				serializedState: string, name: saveName,
				inputActorIds,
			})
			break
		case SaveMethod.ToDataUrl:
			const url = saveToUrl(game)
			feedbackCallback({type: 'saved-to-url', url: url})
			break

	}
}

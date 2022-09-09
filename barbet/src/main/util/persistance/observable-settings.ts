import { Environment } from '../../entry-points/feature-environments/loader';
import { STANDARD_GAME_TICK_RATE } from '../../game-state/state-updater';
import State from '../state';
import { getFromLocalStorage, putInLocalStorage } from './serializable-settings';


const settingsToDefaults = {
	'other/tps': STANDARD_GAME_TICK_RATE,
	'other/pause-on-blur': false,
	'rendering/fps-cap': 0, // vsync only
	'rendering/fps-cap-on-blur': 15,
	'rendering/antialias': (globalThis['devicePixelRatio'] ?? 2) < 1.5, // disable antialias by default on high density displays such as phones
	'rendering/show-tile-borders': false,
	'rendering/ambient-occlusion': true,
	'other/preferred-environment': 'second' as Environment,
	'other/generate-debug-world': true,
}

type SettingName = keyof typeof settingsToDefaults

const CONFIG = State.fromInitial(settingsToDefaults)
export default CONFIG

export const initSettingsFromLocalStorage = () => {
	const values = new Map<SettingName, any>()
	for (const [key, value] of Object.entries(settingsToDefaults)) {
		let fromLocalStorage = getFromLocalStorage(key)
		const invalidType = fromLocalStorage != null && typeof fromLocalStorage !== typeof value
		if (fromLocalStorage == null || invalidType) {
			if (invalidType)
				console.error(`Invalid value for key ${key} in localstorage`)
			fromLocalStorage = value
		}
		values.set(key as SettingName, fromLocalStorage)
	}

	CONFIG.replace(Object.fromEntries(values.entries()) as any)
}

export const saveSettingsToLocalStorage = () => {
	for (const [key, value] of Object.entries(CONFIG.pass()))
		putInLocalStorage(key as string, value)
}

export const observeSetting = <T extends SettingName>(
	key: T,
	callback: (value: typeof settingsToDefaults[T]) => any) => {
	return CONFIG.observe(key, callback, true)
}

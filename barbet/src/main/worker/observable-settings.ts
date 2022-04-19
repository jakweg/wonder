import { STANDARD_GAME_TICK_RATE } from '../game-state/state-updater'
import { getFromLocalStorage, putInLocalStorage } from './serializable-settings'

const settingsToDefaults = {
	'other/tps': STANDARD_GAME_TICK_RATE,
	'other/pause-on-blur': false,
	'rendering/fps-cap': 0, // vsync only
	'rendering/fps-cap-on-blur': 15,
	'rendering/antialias': true,
	'rendering/show-tile-borders': true,
	'other/preferred-environment': 'second',
}

type SettingName = keyof typeof settingsToDefaults

class SettingsContainer {
	public static INSTANCE: SettingsContainer
	private readonly listeners: Map<SettingName, any[]> = new Map<SettingName, any[]>()
	private readonly everythingListeners: any[] = []

	private constructor(private readonly values: Map<SettingName, any>) {
	}

	public static fromLocalstorage() {
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

		return new SettingsContainer(values)
	}

	public static createEmpty() {
		return new SettingsContainer(new Map<SettingName, any>())
	}

	public update(object: any): void {
		for (const [key, newValue] of Object.entries(object)) {
			const oldValue = this.values.get(key as SettingName)
			if (oldValue !== newValue) {
				this.values.set(key as SettingName, newValue)
				this.listeners.get(key as SettingName)?.forEach(e => e(newValue))
			}
		}
	}

	public pass(): any {
		return Object.fromEntries(this.values.entries())
	}

	public saveToLocalStorage(): void {
		for (const [key, value] of this.values.entries())
			putInLocalStorage(key as string, value)
	}

	public set<T extends SettingName>(key: SettingName, value: typeof settingsToDefaults[T]): void {
		const oldValue = this.values.get(key)
		if (oldValue === undefined || oldValue !== value) {
			this.values.set(key, value)
			this.listeners.get(key)?.forEach(e => e(value))
			const snapshot = this.pass()
			this.everythingListeners.forEach(e => e(snapshot))
		}
	}

	public get<T extends SettingName>(key: SettingName): typeof settingsToDefaults[T] {
		return this.values.get(key)
	}

	public observe(key: SettingName,
	               callback: (value: any) => any,
	               initialCall: boolean): any {

		let value = this.values.get(key)
		let list = this.listeners.get(key)
		if (list === undefined) {
			list = []
			this.listeners.set(key, list)
		}
		if (initialCall)
			callback(value)
		list.push(callback)
		return () => {
			const index = list?.indexOf(callback) ?? -1
			if (index >= 0)
				list?.splice(index, 1)
		}
	}

	public observeEverything(callback: (snapshot: any) => any): any {
		this.everythingListeners.push(callback)
		callback(this.pass())
		return () => {
			const index = this.everythingListeners.indexOf(callback) ?? -1
			if (index >= 0)
				this.everythingListeners.splice(index, 1)
		}
	}
}

export default SettingsContainer
export const observeSetting = <T extends SettingName>(
	key: T,
	callback: (value: typeof settingsToDefaults[T]) => any) => {
	return SettingsContainer.INSTANCE.observe(key, callback, true)
}

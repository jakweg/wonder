import { STANDARD_GAME_TICK_RATE } from '../3d-stuff/game-state/state-updater'
import { getFromLocalStorage, putInLocalStorage } from './serializable-settings'

const settingsToDefaults = {
	'other/tps': STANDARD_GAME_TICK_RATE,
	'rendering/fps-cap': 0, // vsync only
	'rendering/fps-cap-on-blur': 15,
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

	public set(key: SettingName, value: any): void {
		const oldValue = this.values.get(key)
		if (oldValue === undefined || oldValue !== value) {
			this.values.set(key, value)
			this.listeners.get(key)?.forEach(e => e(value))
			const snapshot = this.pass()
			this.everythingListeners.forEach(e => e(snapshot))
		}
	}

	public observe(key: SettingName,
	               callback: (value: any) => any): any {

		let value = this.values.get(key)
		let list = this.listeners.get(key)
		if (list === undefined) {
			list = []
			this.listeners.set(key, list)
		}
		callback(value)
		list.push(callback)
		const snapshot = this.pass()
		this.everythingListeners.forEach(e => e(snapshot))
	}

	public observeEverything(callback: (snapshot: any) => any): any {
		this.everythingListeners.push(callback)
		callback(this.pass())
	}
}

export default SettingsContainer
export const observeSetting = <T extends SettingName>(
	key: T,
	callback: (value: typeof settingsToDefaults[T]) => any): void => {
	SettingsContainer.INSTANCE.observe(key, callback)
}

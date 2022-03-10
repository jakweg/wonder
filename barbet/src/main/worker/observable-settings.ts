import { getFromLocalStorage, putInLocalStorage } from './serializable-settings'

const allSettingKeys = ['other/tps'] as const
type SettingName = typeof allSettingKeys[keyof typeof allSettingKeys]

class SettingsContainer {
	public static INSTANCE: SettingsContainer
	private readonly listeners: Map<SettingName, any[]> = new Map<SettingName, any[]>()
	private readonly everythingListeners: any[] = []

	private constructor(private readonly values: Map<SettingName, any>) {
	}

	public static fromLocalstorage() {
		const values = new Map<SettingName, any>()
		for (const key of allSettingKeys)
			values.set(key, getFromLocalStorage(key) ?? null)

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

	public observe(key: SettingName, callback: (value: any) => any): any {
		const value = this.values.get(key)
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
export const observeSetting = (key: SettingName, callback: (value: any) => any): void => {
	SettingsContainer.INSTANCE.observe(key, callback)
}

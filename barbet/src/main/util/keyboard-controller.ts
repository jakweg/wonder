import { FrontendVariable, PressedKey } from './frontend-variables'

const defaultKeyMapping: { [key: string]: PressedKey } = {
	'KeyW': PressedKey.Forward,
	'ArrowUp': PressedKey.Forward,

	'KeyS': PressedKey.Backward,
	'ArrowDown': PressedKey.Backward,

	'KeyA': PressedKey.Left,
	'ArrowLeft': PressedKey.Left,

	'KeyD': PressedKey.Right,
	'ArrowRight': PressedKey.Right,

	'ShiftLeft': PressedKey.Down,
	'Space': PressedKey.Up,
}

class KeyboardController {
	public static INSTANCE: KeyboardController | undefined = undefined
	private pressedKeys: Set<string> = new Set()
	private keyReleasedListeners: Map<string, (code: string) => void> = new Map()
	private maskEnabled: boolean = false

	private constructor(private readonly frontedVariables: Int16Array) {
	}

	public static createNewAndRegisterToWindow(frontedVariables: Int16Array): KeyboardController {
		const controller = new KeyboardController(frontedVariables)

		document.addEventListener('keydown', event => controller.setKeyPressed(event['code'], true))
		document.addEventListener('keyup', event => controller.setKeyPressed(event['code'], false))
		window.addEventListener('blur', () => controller.cancelAllPressed())

		KeyboardController.INSTANCE = controller
		return controller
	}

	public setMaskEnabled(enabled: boolean) {
		if (this.maskEnabled === enabled) return
		if (enabled)
			this.cancelAllPressed()
		this.maskEnabled = enabled
	}

	public cancelAllPressed(): void {
		this.pressedKeys['clear']()
		Atomics.store(this.frontedVariables, FrontendVariable.PressedKeys, PressedKey.None)
	}

	public isAnyPressed(): boolean {
		return this.pressedKeys['size'] !== 0
	}

	public isPressed(code: string): boolean {
		return this.pressedKeys['has'](code)
	}

	private setKeyPressed(code: string, pressed: boolean): void {
		if (this.maskEnabled) return
		if (pressed)
			this.pressedKeys['add'](code)
		else
			this.pressedKeys['delete'](code)

		const mapped = defaultKeyMapping[code] ?? PressedKey.None

		if (mapped === PressedKey.None) {
			if (!pressed)
				this.keyReleasedListeners['get'](code)?.(code)
			return
		}

		if (pressed)
			Atomics.or(this.frontedVariables, FrontendVariable.PressedKeys, mapped)
		else
			Atomics.and(this.frontedVariables, FrontendVariable.PressedKeys, ~mapped)
	}

	public setKeyReleasedListener<T extends string>(code: T, callback: (key: T) => void) {
		if (this.keyReleasedListeners['has'](code)) throw new Error()
		this.keyReleasedListeners['set'](code, callback)
	}
}

export default KeyboardController

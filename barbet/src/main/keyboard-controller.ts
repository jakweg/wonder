import { FrontendVariable, PressedKey } from './util/frontend-variables'

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
	private pressedKeys: { [key: string]: boolean } = {}
	private pressedCount: number = 0

	private constructor(private readonly frontedVariables: Int16Array) {
	}

	public static createNewAndRegisterToWindow(frontedVariables: Int16Array): KeyboardController {
		const controller = new KeyboardController(frontedVariables)

		document.addEventListener('keydown', event => controller.setKeyPressed(event['code'], true))
		document.addEventListener('keyup', event => controller.setKeyPressed(event['code'], false))
		window.addEventListener('blur', () => controller.cancelAllPressed())

		return controller
	}

	public cancelAllPressed(): void {
		const keys = this.pressedKeys
		for (const code in keys)
			keys[code] = false
		this.pressedCount = 0
		Atomics.store(this.frontedVariables, FrontendVariable.PressedKeys, PressedKey.None)
	}

	public isAnyPressed(): boolean {
		return this.pressedCount !== 0
	}

	public isPressed(code: string): boolean {
		if (this.pressedCount === 0) return false
		return this.pressedKeys[code] ?? false
	}

	private setKeyPressed(code: string, pressed: boolean): void {
		const pressedKeys = this.pressedKeys
		if (pressedKeys[code] === pressed) return
		pressedKeys[code] = pressed
		this.pressedCount += pressed ? 1 : -1
		if (this.pressedCount < 0)
			this.pressedCount = 0

		const mapped = defaultKeyMapping[code] ?? PressedKey.None

		if (mapped === PressedKey.None) return

		if (pressed)
			Atomics.or(this.frontedVariables, FrontendVariable.PressedKeys, mapped)
		else
			Atomics.and(this.frontedVariables, FrontendVariable.PressedKeys, ~mapped)
	}
}

export default KeyboardController

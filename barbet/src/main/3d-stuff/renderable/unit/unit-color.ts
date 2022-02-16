export type Color = [number, number, number]

export interface UnitColorPalette {
	primary: Color
	secondary: Color
	face: Color
}

export const example1: UnitColorPalette = { // green/orange
	primary: [1, 0.6171875, 0.00390625],
	secondary: [0.62890625, 0.99609375, 0.40625],
	face: [0.1171875, 0.4375, 0],
}
export const example2: UnitColorPalette = { // dark blue
	primary: [0, 0.37890625, 0.53515625],
	secondary: [0, 0.58984375, 0.63671875],
	face: [0.83203125, 0.984375, 0.99609375],
}

export const example3: UnitColorPalette = { // light orange
	primary: [0.984375, 0.703125, 0.140625],
	secondary: [0.9921875, 0.99609375, 0.78125],
	face: [0.3984375, 0.234375, 0.0546875],
}

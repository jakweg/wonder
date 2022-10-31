import { Header } from '.'
import { constant } from '../../util/state/subject'
import { createElement } from '../utils'
import { BooleanSwitch } from './helper-components'

export default (root: HTMLElement) => {
	Header(root, constant('Developer'), true)
	const main = createElement('main', root)

	BooleanSwitch(main, 'debug/debug-world', v => `Debug world: ${v ? 'ON' : 'OFF'}`)
	BooleanSwitch(main, 'debug/disable-culling', v => `Culling: ${v ? 'OFF' : 'ON'}`)
	BooleanSwitch(main, 'debug/show-info', v => `Floating info: ${v ? 'ON' : 'OFF'}`)
	BooleanSwitch(main, 'debug/show-graphs', v => `Graphs: ${v ? 'ON' : 'OFF'}`)
}


import { CODE_STATS_LINES_COUNT, COMMIT_HASH, DEBUG } from '../../util/build-info'
import { sharedMemoryIsAvailable } from '../../util/shared-memory'
import { createElement } from '../utils'

export default (root: HTMLElement) => {
	const p = createElement('p', root, '_css_build-info')
	p['innerText'] = [
		`Build ${COMMIT_HASH} (${DEBUG ? 'debug' : 'production'}) • Lines of code: ${CODE_STATS_LINES_COUNT}`,
		`Shared memory: ${sharedMemoryIsAvailable ? '' : 'un'}available • Offscreen canvas: ${!!((window as any).OffscreenCanvas) ? '' : 'un'}available`,
	].join('\n')
}

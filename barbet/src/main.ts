console.log('Hello from main')

import { DEBUG, JS_ROOT } from './build-info.ts'
import { who } from './second.ts'

const foo = (): string | null => {
	return null
}
const xd = foo()
console.log(`Hello ${who}! ${xd?.substring(1) ?? 'ff'}`)
console.log(`This is ${DEBUG ? 'dev' : 'prod'} build`)

const buffer = new SharedArrayBuffer(100)
console.log(buffer)
const worker = new Worker(JS_ROOT + '/worker.js')
worker.addEventListener('message', (event) => {
	const now = Date.now()
	const one = event.data.pong - event.data.ping
	const two = now - event.data.pong
	const total = now - event.data.ping
	console.log({one, two, total})
})
worker.postMessage({ping: Date.now()})

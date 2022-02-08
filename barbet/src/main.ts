console.log('Hello from main')

import { DEBUG } from './build-info.ts'
import { who } from './second.ts'

const foo = (): string | null => {
	return null
}
const xd = foo()
console.log(`Hello ${who}! ${xd?.substring(1) ?? 'ff'}`)
console.log(`This is ${DEBUG ? 'dev' : 'prod'} build`)

import { assertEquals } from 'https://deno.land/std@0.125.0/testing/asserts.ts'
import { add } from '../main/a.ts'


Deno.test('Addition works 1', () => {
	assertEquals(4, add(2, 2))
})
Deno.test('Addition works 2', () => {
	assertEquals(0, add(2, -2))
})

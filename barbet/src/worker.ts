console.log('Hello from worker, root is')

addEventListener('message', (event) => {
	const data = {...event.data, pong: Date.now()}
	postMessage(data)
})

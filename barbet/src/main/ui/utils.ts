export const createElement = (type: string,
                              attachTo: HTMLElement | undefined = undefined,
                              className: string = '') => {
	const htmlElement = document.createElement(type) as HTMLElement
	if (className) htmlElement['classList']['add'](className)
	attachTo?.appendChild(htmlElement)
	return htmlElement
}

export type Callback = () => void

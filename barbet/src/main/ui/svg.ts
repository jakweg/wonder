export default (parent: HTMLElement, paths: string[]): SVGElement => {
  const svg = document['createElementNS']('http://www.w3.org/2000/svg', 'svg')
  parent['appendChild'](svg)
  const size = 24
  svg['setAttribute']('height', `${size}px`)
  svg['setAttribute']('width', `${size}px`)
  svg['setAttribute']('viewBox', `0 0 ${size} ${size}`)

  for (const content of paths) {
    const pathElement = document['createElementNS']('http://www.w3.org/2000/svg', 'path')
    svg['appendChild'](pathElement)
    pathElement['setAttribute']('d', content)
  }
  return svg
}

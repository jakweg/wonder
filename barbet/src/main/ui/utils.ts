export const createElement = (type: string, attachTo: HTMLElement | undefined = undefined, className: string = '') => {
  const htmlElement = document.createElement(type) as HTMLElement
  if (className) htmlElement['classList']['add'](...className['split'](' '))
  attachTo?.['appendChild'](htmlElement)
  return htmlElement
}

export type Callback = () => void

export const askForFile = async () => {
  return new Promise<File | null>(resolve => {
    const input = document.createElement('input')
    input['type'] = 'file'
    input['accept'] = '.json'
    input['oninput'] = () => {
      const selectedFile = input['files']?.[0]
      if (selectedFile == null) {
        resolve(null)
        return
      }
      resolve(selectedFile)
    }
    input['click']()
  })
}

export const downloadSaveToDeviceStorage = (url: string, name: string, keepObject: boolean = false) => {
  const anchor = document.createElement('a')
  anchor['href'] = url
  anchor['download'] = name
  anchor['click']()
  if (!keepObject) URL.revokeObjectURL(url)
}

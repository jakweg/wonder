export const createArray = <T>(length: number, initializer: (i: number) => T): T[] => {
  const tmp = []
  for (let i = 0; i < length; ++i) {
    tmp.push(initializer(i))
  }
  return tmp
}

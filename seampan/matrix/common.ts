export const EPSILON = 0.000001;

const degree = Math.PI / 180;

export function toRadian(a: number): number {
  return a * degree;
}

export const toGl = (a: any): Float32List => a;

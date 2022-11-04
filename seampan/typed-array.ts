type TypedArray =
    | Int8Array
    | Uint8Array
    | Uint8ClampedArray
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | Float32Array
    | Float64Array;

export default TypedArray

export type TypedArrayConstructor<T extends TypedArray> = (new (length: number) => T) & (new (buffer: SharedArrayBuffer) => T) & { BYTES_PER_ELEMENT: number }
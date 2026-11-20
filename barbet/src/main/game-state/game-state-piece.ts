export const SERIALIZE = Symbol()
export const PASS = Symbol()

export default interface GameStatePiece {
    /** Invoked when serializing this game into binary format that can be read later, after client restart or by other clients */
    [SERIALIZE]: () => unknown
    /** Invoked when passing from update-worker into render-worker */
    [PASS]: () => unknown
}

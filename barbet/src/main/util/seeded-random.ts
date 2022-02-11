class SeededRandom {
	private constructor(private seed: number) {
	}

	public static fromSeed(seed: number): SeededRandom {
		return new SeededRandom(seed)
	}

	public next(): number {
		return ((this.seed = Math.imul(1597334677, this.seed)) >>> 0) / 2 ** 32
	}

	public nextInt(max: number): number {
		return this.next() * max | 0
	}
}

export default SeededRandom

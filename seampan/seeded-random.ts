class SeededRandom {
	private constructor(private seed: number) {
	}

	public static fromSeed(seed: number): SeededRandom {
		return new SeededRandom(seed)
	}

	public getCurrentSeed(): number {
		return this.seed
	}

	public next(): number {
		return ((this.seed = Math.imul(1597334677, this.seed)) >>> 0) / 2 ** 32
	}

	public static singleRandom(seed: number): number {
		return (Math.imul(1597334677, seed) >>> 0) / 2 ** 32
	}

	public nextInt(max: number): number {
		return this.next() * max | 0
	}

	public nextIntRange(min: number, max: number): number {
		return (min + this.next() * (max - min)) | 0
	}
}

export default SeededRandom

import { mulberry32, withSeededRandom } from './seeded-random';

describe('seeded-random', () => {
  it('Should be reproducible and in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x >= 0 && x < 1).toBeTrue();
    }
  });

  it('Should restore Math.random, even on error', () => {
    const original = Math.random;
    expect(() => withSeededRandom(1, () => { throw new Error('x'); })).toThrow();
    expect(Math.random).toBe(original);
    expect(withSeededRandom(5, () => Math.random())).toBe(withSeededRandom(5, () => Math.random()));
  });
});

import { versionCodeFromSemver } from './versionCode';

describe('versionCodeFromSemver', () => {
  it('maps the first release to 10000', () => {
    expect(versionCodeFromSemver('1.0.0')).toBe(10000);
  });

  it('is strictly increasing across releases', () => {
    const codes = ['1.0.9', '1.1.0', '2.0.0'].map(versionCodeFromSemver);
    expect(codes).toEqual([10009, 10100, 20000]);
    expect(codes[0]).toBeLessThan(codes[1] as number);
    expect(codes[1]).toBeLessThan(codes[2] as number);
  });

  it('accepts the largest minor and patch values', () => {
    expect(versionCodeFromSemver('1.99.99')).toBe(19999);
  });

  it.each(['abc', '1.2', '', '1.0.0-beta.1', '1.0.0+build.5', 'v1.0.0', '1.0.0.0'])(
    'throws on non-semver input %j',
    (input) => {
      expect(() => versionCodeFromSemver(input)).toThrow();
    },
  );

  it.each(['1.100.0', '1.0.100'])('throws when minor or patch exceeds 99 (%s)', (input) => {
    expect(() => versionCodeFromSemver(input)).toThrow(/99/);
  });
});

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  // With a cold transform cache, the first render that mounts list cells
  // (FlatList, Pressable) transforms those modules inside the test body, and
  // all workers compete for CPU. That alone exceeded the 5 s default.
  testTimeout: 15000,
};

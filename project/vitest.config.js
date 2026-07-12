import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.js'],
    // The suite is small (~1s) and mesh.test.js waits on real timers for
    // cross-instance BroadcastChannel delivery — running test files across
    // multiple worker threads/processes under CPU contention (esp. alongside
    // crypto.test.js's PBKDF2 derivations) made those waits occasionally miss
    // even generous timeouts on constrained runners. Single-threaded execution
    // trades a little speed for determinism, which is the right trade here.
    fileParallelism: false,
    // Vitest's own default (5000ms) is shorter than mesh.test.js's defensive
    // 8000ms fallback for cold-container timer waits — raise it so that ceiling
    // can actually apply instead of Vitest killing the test first.
    testTimeout: 15000
  }
});

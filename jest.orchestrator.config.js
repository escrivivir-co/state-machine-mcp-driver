/**
 * Jest configuration for orchestrator tests
 */

module.exports = {
  displayName: 'Orchestrator Tests',
  testMatch: [
    '<rootDir>/src/orchestration/__tests__/**/*.test.ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: [
    'src/orchestration/**/*.ts',
    '!src/orchestration/**/*.test.ts',
    '!src/orchestration/__tests__/**/*'
  ],
  coverageDirectory: 'coverage/orchestrator',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 10000, // 10 seconds for integration tests
  verbose: true,
  detectOpenHandles: true,
  forceExit: true
};

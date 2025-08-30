#!/usr/bin/env node

/**
 * Test runner for orchestrator tests
 * Runs the orchestrator test suite with proper setup
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Running Orchestrator Test Suite...\n');

// Configure test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'info';

// Run Jest with specific configuration for orchestrator tests
const jestArgs = [
  '--testPathPattern=orchestration/__tests__',
  '--verbose',
  '--detectOpenHandles',
  '--forceExit',
  '--runInBand', // Run tests serially to avoid conflicts
  '--setupFilesAfterEnv=<rootDir>/tests/setup.ts'
];

const jest = spawn('npx', ['jest', ...jestArgs], {
  stdio: 'inherit',
  cwd: process.cwd()
});

jest.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ All orchestrator tests passed!');
  } else {
    console.log('\n❌ Some tests failed.');
  }
  process.exit(code);
});

jest.on('error', (error) => {
  console.error('Error running tests:', error);
  process.exit(1);
});

/**
 * Simple mock logger for tests
 */

/**
 * Simple test for logger functionality
 */

import { Logger } from '../../utils/logger';

describe('Logger', () => {
  it('should be available', () => {
    expect(Logger).toBeDefined();
    expect(typeof Logger.info).toBe('function');
    expect(typeof Logger.error).toBe('function');
  });

  it('should log messages without throwing', () => {
    expect(() => {
      Logger.info('Test message');
      Logger.error('Test error');
    }).not.toThrow();
  });
});

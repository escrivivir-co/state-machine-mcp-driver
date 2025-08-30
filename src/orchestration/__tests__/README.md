# Orchestrator Test Suite

This test suite provides comprehensive testing for the RxJS-based Orchestrator system, including the three communication channels (AppChannel, SysChannel, UIChannel) and their integration.

## Test Structure

### 1. Channel Unit Tests (`channels.test.ts`)
Tests individual channel functionality:
- **AppChannelImpl**: Action requests, state transitions, replay buffer
- **SysChannelImpl**: Info, error, warning messages, health checks
- **UIChannelImpl**: User input, display updates, notifications, phase changes
- **Channel Integration**: Cross-channel communication and independent state

### 2. Integration Tests (`orchestrator.test.ts`)
Tests the complete orchestrator system with test agents:
- **SysAgent**: System lifecycle management (READY, CLOSE events)
- **AppAgent**: Application state management (responds to system events)
- **UIAgent**: UI interaction handling (responds to system and app events)
- **LogAgent**: Comprehensive monitoring and logging of all channels

### 3. Test Agents (`test-agents.ts`)
Specialized components for testing orchestrator behavior:
- Event tracking and verification
- Automated response patterns
- Statistics and reporting

## Test Scenarios

### Standard Event Sequence
1. **SysAgent** sends `READY` event
2. **AppAgent** and **UIAgent** respond with `INIT` events
3. **SysAgent** sends `CLOSE` event
4. All agents respond with their own `CLOSE` events
5. **LogAgent** captures and verifies the complete sequence

### Feature Ready Broadcasts
- SysAgent broadcasts feature availability
- All agents receive and respond appropriately
- UI updates feature status displays

### Cross-Channel Routing
- Messages sent on one channel trigger responses on other channels
- State changes in app channel update UI displays
- System errors are displayed as UI notifications

## Running Tests

### Run All Orchestrator Tests
```bash
npm run test:orchestrator
# or
node scripts/test-orchestrator.js
```

### Run Individual Test Suites
```bash
# Channel unit tests only
npx jest src/orchestration/__tests__/channels.test.ts

# Integration tests only
npx jest src/orchestration/__tests__/orchestrator.test.ts

# With coverage
npx jest --config jest.orchestrator.config.js --coverage
```

### Test with Verbose Output
```bash
npx jest src/orchestration/__tests__ --verbose
```

## Test Configuration

The tests use a specialized Jest configuration (`jest.orchestrator.config.js`) with:
- Increased timeout for integration tests (10 seconds)
- Serial test execution to avoid conflicts
- Coverage reporting for orchestrator components
- Proper TypeScript transformation

## Expected Test Results

### Unit Tests
- ✅ Channel message sending and receiving
- ✅ Replay buffer functionality
- ✅ Channel statistics tracking
- ✅ Independent channel state management

### Integration Tests
- ✅ Complete agent lifecycle (initialization → operation → shutdown)
- ✅ Event sequence validation (READY → INIT → CLOSE)
- ✅ Cross-channel message routing
- ✅ Feature broadcast handling
- ✅ Comprehensive event logging
- ✅ Performance under rapid message sequences
- ✅ Error handling and recovery

### Sample Output
```
🧪 Running Orchestrator Test Suite...

 PASS  src/orchestration/__tests__/channels.test.ts
 PASS  src/orchestration/__tests__/orchestrator.test.ts

Test Suites: 2 passed, 2 total
Tests:       25 passed, 25 total
Snapshots:   0 total
Time:        3.456 s

✅ All orchestrator tests passed!
```

## Test Agents Behavior

### SysAgent
- Manages system lifecycle events
- Sends READY to initialize other agents
- Sends CLOSE to shutdown system
- Broadcasts feature availability
- Acknowledges app and UI initialization

### AppAgent
- Waits for system READY before initializing
- Sends APP_INIT when system is ready
- Responds to system CLOSE with its own close
- Manages application state transitions

### UIAgent
- Waits for system READY before initializing
- Sends UI_INIT when system is ready
- Responds to system CLOSE with its own close
- Updates displays based on feature availability
- Shows state changes from app events

### LogAgent
- Monitors ALL channels passively
- Records comprehensive event history
- Provides filtering and reporting capabilities
- Generates statistics and sequence analysis
- Validates event timing and order

## Debugging Tests

### Enable Debug Logging
```bash
LOG_LEVEL=debug npm run test:orchestrator
```

### Run Single Test
```bash
npx jest --testNamePattern="should execute the READY -> INIT -> CLOSE sequence correctly"
```

### Test with Coverage
```bash
npx jest --config jest.orchestrator.config.js --coverage --coverageDirectory=coverage/orchestrator
```

## Test Data Validation

Each test validates:
- **Message Structure**: Correct type, source, payload format
- **Event Timing**: Proper sequence and timing of events
- **Channel Isolation**: Independent channel state and statistics
- **Cross-Channel Routing**: Correct message forwarding between channels
- **Agent Behavior**: Expected responses to system events
- **Error Handling**: Graceful error recovery
- **Performance**: Message throughput and processing time

## Extending Tests

To add new test scenarios:

1. **Add new test agents** in `test-agents.ts`
2. **Create test scenarios** in `orchestrator.test.ts`
3. **Test new channel methods** in `channels.test.ts`
4. **Update documentation** with new test patterns

Example new test:
```typescript
it('should handle custom agent interaction', async () => {
  // Setup custom agents
  const customAgent = new CustomTestAgent();
  await orchestrator.registerComponent(customAgent);
  
  // Execute test scenario
  customAgent.sendCustomEvent();
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Validate results
  const events = logAgent.getEventsBySource('custom-agent');
  expect(events.length).toBeGreaterThan(0);
});
```

This comprehensive test suite ensures the orchestrator system works correctly under various conditions and provides confidence in the RxJS-based communication architecture.

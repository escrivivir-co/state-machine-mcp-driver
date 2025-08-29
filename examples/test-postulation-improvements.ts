/**
 * Test script to demonstrate the improved postulation system
 * Shows how the system now guarantees at least one greedy agent option
 */

import { XPlus1PostulationSystem } from './x-plus-1-state-machine/XPlus1PostulationSystem';
import { Agent, AgentRole, AgentStatus } from '../src/models/Agent';
import { PostulationContext } from '../src/models/AgentPostulation';

// Create mock agents
const mockAgents: Agent[] = [
  {
    id: 'dionisio-bot',
    name: 'DionisioBot',
    role: AgentRole.PLAYER,
    status: AgentStatus.ACTIVE,
    config: {},
    priority: 2,
    stats: {
      actionsExecuted: 0,
      messagesProcessed: 0,
      errorsEncountered: 0,
      lastActivity: Date.now()
    }
  },
  {
    id: 'apolo-bot', 
    name: 'ApoloBot',
    role: AgentRole.GUIDE,
    status: AgentStatus.ACTIVE,
    config: {},
    priority: 2,
    stats: {
      actionsExecuted: 0,
      messagesProcessed: 0,
      errorsEncountered: 0,
      lastActivity: Date.now()
    }
  },
  {
    id: 'justice-bot',
    name: 'JusticeBot',
    role: AgentRole.NARRATOR,
    status: AgentStatus.ACTIVE,
    config: {},
    priority: 1,
    stats: {
      actionsExecuted: 0,
      messagesProcessed: 0,
      errorsEncountered: 0,
      lastActivity: Date.now()
    }
  }
];

function testPostulationSystem() {
  console.log('🧪 Testing Improved Postulation System');
  console.log('=====================================\n');

  const postulationSystem = new XPlus1PostulationSystem();
  const manager = postulationSystem.getManager();

  // Test various scenarios
  const scenarios = [
    {
      name: 'Early Game (1/10 messages)',
      context: {
        messageCount: 1,
        maxMessages: 10,
        availableAgents: mockAgents,
        gameState: { x: 0 }
      }
    },
    {
      name: 'Mid Game (5/10 messages)',
      context: {
        messageCount: 5,
        maxMessages: 10,
        availableAgents: mockAgents,
        gameState: { x: 3 }
      }
    },
    {
      name: 'Late Game (8/10 messages) - Critical!',
      context: {
        messageCount: 8,
        maxMessages: 10,
        availableAgents: mockAgents,
        gameState: { x: 5 },
        flags: { isUrgent: true }
      }
    },
    {
      name: 'Last Message (9/10 messages) - VERY Critical!',
      context: {
        messageCount: 9,
        maxMessages: 10,
        availableAgents: mockAgents,
        gameState: { x: 2 },
        flags: { isUrgent: true }
      }
    }
  ];

  scenarios.forEach((scenario, index) => {
    console.log(`📊 Scenario ${index + 1}: ${scenario.name}`);
    console.log(`   Remaining messages: ${scenario.context.maxMessages - scenario.context.messageCount}`);
    
    const postulations = manager.generatePostulations(scenario.context as PostulationContext);
    
    console.log(`   Generated ${postulations.length} postulation(s):`);
    
    if (postulations.length === 0) {
      console.log('   ❌ NO POSTULATIONS - This should not happen with improved system!');
    } else {
      postulations.forEach((p, i) => {
        const greedyIcon = p.greediness === 'very_greedy' ? '🍴' : 
                          p.greediness === 'neutral' ? '🤔' : 
                          p.greediness === 'satisfied' ? '😌' : '😴';
        const forceIcon = p.metadata?.forcedGreedySelection ? ' 🎯 (FORCED)' : '';
        
        console.log(`     ${i + 1}. ${greedyIcon} ${p.agent.name} (${p.greediness}) - ${p.reason}${forceIcon}`);
        console.log(`        Priority: ${p.priority}, Weight: ${p.weight.toFixed(1)}`);
      });
      
      // Check if we have at least one greedy option
      const greedyCount = postulations.filter(p => 
        p.greediness === 'very_greedy' || p.greediness === 'neutral'
      ).length;
      
      if (greedyCount > 0) {
        console.log(`   ✅ ${greedyCount} greedy agent(s) available for selection`);
      } else {
        console.log(`   ⚠️  No greedy agents available - this indicates a problem!`);
      }
    }
    
    console.log('');
  });

  console.log('🎯 Summary: The improved system should guarantee at least one greedy option in all scenarios!');
}

// Run the test
testPostulationSystem();

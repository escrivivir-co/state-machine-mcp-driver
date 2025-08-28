/**
 * Test script to verify JSON configuration loading
 */

import { 
  loadWikiTopics, 
  loadWikiContent, 
  loadWikiMessages,
  loadXPlus1Messages
} from './config-loader';

console.log('🧪 Testing configuration loading...\n');

try {
  // Test wiki topics
  const topics = loadWikiTopics();
  console.log('✅ Wiki topics loaded:');
  console.log('  - Dionisio topics:', topics.dionisio.length);
  console.log('  - Apolo topics:', topics.apolo.length);

  // Test wiki content
  const content = loadWikiContent();
  console.log('✅ Wiki content loaded:');
  console.log('  - Cosmic entries:', Object.keys(content.cosmic).length);
  console.log('  - Historical entries:', Object.keys(content.historical).length);

  // Test wiki messages
  const wikiMessages = loadWikiMessages();
  console.log('✅ Wiki messages loaded:');
  console.log('  - Server starting:', wikiMessages.messages.server.starting);

  // Test xplus1 messages
  const xplus1Messages = loadXPlus1Messages();
  console.log('✅ XPlus1 messages loaded:');
  console.log('  - Server starting:', xplus1Messages.messages.server.starting);

  console.log('\n🎉 All configurations loaded successfully!');

  // Test template replacement
  console.log('\n🔧 Testing template replacement:');
  const template = wikiMessages.messages.browsing.template;
  const result = template
    .replace('{agentType}', 'DIONISIO')
    .replace('{topic}', 'Universe');
  console.log('  Template result:', result);

} catch (error) {
  console.error('❌ Configuration loading failed:', error);
  process.exit(1);
}

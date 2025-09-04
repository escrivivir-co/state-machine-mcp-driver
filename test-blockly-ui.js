#!/usr/bin/env node

/**
 * Test script for BlocklyGamificationUI
 * Verifies that the Angular assets are properly served
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const PORT = 9094;
const STATIC_DIR = path.join(__dirname, 'public_templates', 'blockly-gamify-ui');

console.log('🧩 Testing Blockly UI Assets...');
console.log(`📁 Static directory: ${STATIC_DIR}`);
console.log(`📁 Directory exists: ${fs.existsSync(STATIC_DIR)}`);

if (fs.existsSync(STATIC_DIR)) {
  const files = fs.readdirSync(STATIC_DIR);
  console.log(`📄 Files found:`, files);
  
  const indexPath = path.join(STATIC_DIR, 'index.html');
  console.log(`📄 index.html exists: ${fs.existsSync(indexPath)}`);
  
  if (fs.existsSync(indexPath)) {
    const app = express();
    
    // Serve static files
    app.use(express.static(STATIC_DIR));
    
    // SPA fallback
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api/')) {
        res.sendFile(indexPath);
      }
    });
    
    const server = app.listen(PORT, () => {
      console.log(`✅ Blockly UI test server started on http://localhost:${PORT}`);
      console.log('🌐 Open this URL in your browser to test');
      console.log('⏹️  Press Ctrl+C to stop');
    });
    
    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping test server...');
      server.close(() => {
        console.log('✅ Server stopped');
        process.exit(0);
      });
    });
    
  } else {
    console.log('❌ index.html not found');
    process.exit(1);
  }
} else {
  console.log('❌ Static directory not found');
  console.log('💡 Run: node node_modules/blockly-alephscript-sdk/packages/blockly-gamify-ui/postinstall.cjs');
  process.exit(1);
}

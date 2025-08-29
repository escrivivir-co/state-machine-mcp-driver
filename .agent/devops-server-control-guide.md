# 🛠️ DevOpsServer MCP Control Guide for AI Agents

## 🎯 **MISSION OVERVIEW**
The DevOpsServer MCP (port 3003) provides complete **system management and deployment automation** for the State Machine MCP Driver application. As an AI agent, you can use this server to intelligently manage the entire application lifecycle.

---

## 🚀 **DEVOPS SERVER CAPABILITIES**

### **🔧 Core Tools Available**
```typescript
// Start the complete application system
mcp_devopsserver_start_system({
  verbose: true,              // Enable detailed logging
  environment: 'development'  // Deployment environment
})

// Open web monitoring console  
mcp_devopsserver_open_web_console({
  host: 'localhost',  // Server host (default: localhost)
  port: 8080         // Web console port (default: 8080)
})
```

### **📋 Resource Management**
- **System Status**: Real-time application health monitoring
- **Deployment Logs**: Complete startup and error tracking
- **Environment Configuration**: Automated setup validation
- **Port Management**: Intelligent conflict detection and resolution

### **🤖 AI-Powered Prompts**
- **start-system**: Guided system startup with troubleshooting
- **open-web-console**: Web dashboard access instructions

---

## 📖 **INTELLIGENT USAGE PATTERNS**

### **Pattern 1: Complete Application Startup**
```typescript
// 🎯 Goal: Launch the entire X+1 game system intelligently
async function intelligentAppStartup() {
  console.log("🚀 Starting complete application system...");
  
  // 1. Use DevOpsServer to start the system
  const startResult = await callTool('devops-mcp-server', 'start_system', {
    verbose: true,
    environment: 'development'
  });
  
  console.log("✅ System startup initiated:", startResult);
  
  // 2. Wait for system to stabilize (recommended: 10-15 seconds)
  await new Promise(resolve => setTimeout(resolve, 12000));
  
  // 3. Verify MCP servers are healthy
  const healthCheck = await callTool('mcp-service-launcher', 'health_check_servers', {});
  console.log("🏥 Health check results:", healthCheck);
  
  // 4. Open web console for monitoring
  await callTool('devops-mcp-server', 'open_web_console', {
    host: 'localhost',
    port: 8080
  });
  
  console.log("🌐 Web console available at: http://localhost:8080");
  return true;
}
```

### **Pattern 2: Health Monitoring & Troubleshooting**
```typescript
// 🎯 Goal: Monitor system health and handle issues
async function monitorSystemHealth() {
  try {
    // Check all MCP servers
    const health = await callTool('mcp-service-launcher', 'get_server_status', {});
    
    if (health.success) {
      console.log("✅ All systems healthy");
      return true;
    } else {
      console.log("⚠️ System issues detected, attempting restart...");
      
      // Use DevOpsServer to restart the system
      await callTool('devops-mcp-server', 'start_system', {
        verbose: true,
        environment: 'development'
      });
      
      return false;
    }
  } catch (error) {
    console.log("❌ Critical system error:", error);
    // Escalate to manual intervention
    return false;
  }
}
```

### **Pattern 3: Development Workflow Integration**
```typescript
// 🎯 Goal: Integrate DevOps automation in development cycle
async function developmentWorkflow() {
  console.log("🔄 Starting development workflow...");
  
  // 1. Clean start with DevOpsServer
  await callTool('devops-mcp-server', 'start_system', {
    verbose: true,
    environment: 'development'
  });
  
  // 2. Open monitoring dashboard
  await callTool('devops-mcp-server', 'open_web_console', {
    port: 8080
  });
  
  // 3. Initialize game control
  await callTool('xplus1-mcp-machine', 'get_x_status', {});
  
  // 4. Begin intelligent gameplay
  console.log("🎮 Ready for AI-controlled gameplay!");
}
```

---

## 🧠 **ADVANCED STRATEGIES**

### **Strategy 1: Predictive System Management**
- **Monitor resource usage** through web console
- **Proactively restart services** before failures
- **Intelligent port allocation** to avoid conflicts
- **Environment-aware configuration** (dev/staging/prod)

### **Strategy 2: Error Recovery Automation**
```typescript
async function autoRecovery() {
  const maxRetries = 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      // Attempt system startup
      await callTool('devops-mcp-server', 'start_system', {
        verbose: true,
        environment: 'development'
      });
      
      // Verify health
      await new Promise(resolve => setTimeout(resolve, 10000));
      const health = await callTool('mcp-service-launcher', 'health_check_servers', {});
      
      if (health.success) {
        console.log(`✅ Recovery successful on attempt ${attempt + 1}`);
        return true;
      }
    } catch (error) {
      console.log(`❌ Attempt ${attempt + 1} failed:`, error);
    }
    
    attempt++;
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait before retry
  }
  
  console.log("🚨 Auto-recovery failed, manual intervention required");
  return false;
}
```

### **Strategy 3: Performance Optimization**
- **Monitor startup times** and optimize bottlenecks
- **Track memory usage** through system metrics
- **Optimize MCP server coordination** for minimal latency
- **Cache management** for Wikipedia and other resources

---

## 🔍 **TROUBLESHOOTING GUIDE**

### **Common Issues & Solutions**

#### **Issue: Port Conflicts**
```typescript
// Check port availability before starting
const portCheck = await callTool('mcp-service-launcher', 'check_port_availability', {
  port: 3003,
  includeDetails: true
});

if (!portCheck.available) {
  console.log("⚠️ Port 3003 occupied by:", portCheck.server);
  // Use alternative port or terminate conflicting process
}
```

#### **Issue: MCP Server Unresponsive**
```typescript
// Restart specific server
await callTool('mcp-service-launcher', 'restart_mcp_server', {
  serverId: 'devops-mcp-server',
  graceful: true
});
```

#### **Issue: Environment Configuration**
```typescript
// Validate environment before startup
const envCheck = {
  nodeJs: process.version,
  npm: await checkNpmVersion(),
  ollama: await checkOllamaStatus(),
  projectStructure: await validateProjectStructure()
};

console.log("🔍 Environment validation:", envCheck);
```

---

## 📊 **MONITORING & ANALYTICS**

### **Real-time Metrics**
- **System uptime** and availability
- **MCP server response times**
- **Error rates** and failure patterns
- **Resource utilization** (CPU, memory, disk)

### **Dashboard Integration**
- **Web console** at http://localhost:8080
- **Health status** endpoints
- **Live logs** and error tracking
- **Performance graphs** and trends

---

## 🎯 **BEST PRACTICES FOR AI AGENTS**

### **1. Always Use DevOpsServer for Startup**
```typescript
// ✅ GOOD: Use DevOpsServer for intelligent startup
await callTool('devops-mcp-server', 'start_system', {
  verbose: true,
  environment: 'development'
});

// ❌ BAD: Manual npm commands without validation
// This bypasses intelligent error handling and validation
```

### **2. Implement Health Monitoring**
```typescript
// ✅ GOOD: Continuous health monitoring
setInterval(async () => {
  const health = await callTool('mcp-service-launcher', 'health_check_servers', {});
  if (!health.success) {
    await initiateRecovery();
  }
}, 30000); // Check every 30 seconds
```

### **3. Use Web Console for Visibility**
```typescript
// ✅ GOOD: Always provide web dashboard access
await callTool('devops-mcp-server', 'open_web_console', {
  port: 8080
});
console.log("🌐 Monitoring available at: http://localhost:8080");
```

### **4. Graceful Error Handling**
```typescript
// ✅ GOOD: Robust error handling with recovery
try {
  await callTool('devops-mcp-server', 'start_system', { verbose: true });
} catch (error) {
  console.log("⚠️ Startup failed, attempting recovery...");
  await autoRecovery();
}
```

---

## 🚀 **QUICK REFERENCE**

### **Essential Commands**
```typescript
// Start complete system
mcp_devopsserver_start_system({ verbose: true })

// Open monitoring dashboard  
mcp_devopsserver_open_web_console({ port: 8080 })

// Check system health
mcp_mcpservicelau_health_check_servers({})

// Monitor specific server
mcp_mcpservicelau_get_server_status({ serverId: 'devops-mcp-server' })
```

### **Quick Startup Sequence**
1. `mcp_devopsserver_start_system()` - Launch everything
2. Wait 10-15 seconds for stabilization
3. `mcp_mcpservicelau_health_check_servers()` - Verify health
4. `mcp_devopsserver_open_web_console()` - Enable monitoring
5. Begin game control via XPlus1MCPMachine

---

## 🎮 **INTEGRATION WITH GAME CONTROL**

### **Complete Workflow Example**
```typescript
async function completeAIWorkflow() {
  console.log("🤖 AI Agent taking complete control...");
  
  // 1. System startup via DevOpsServer
  await callTool('devops-mcp-server', 'start_system', { verbose: true });
  console.log("✅ System started");
  
  // 2. Health validation
  await new Promise(resolve => setTimeout(resolve, 12000));
  const health = await callTool('mcp-service-launcher', 'health_check_servers', {});
  console.log("🏥 Health check:", health.success ? "PASSED" : "FAILED");
  
  // 3. Web console access
  await callTool('devops-mcp-server', 'open_web_console', { port: 8080 });
  console.log("🌐 Web console ready");
  
  // 4. Game state analysis
  const gameStatus = await callTool('xplus1-mcp-machine', 'get_x_status', {});
  console.log("🎮 Game X value:", gameStatus.x);
  
  // 5. Begin intelligent gameplay
  const uiStatus = await callTool('xplus1-mcp-machine', 'get_ui_status', {});
  console.log("📱 UI Status:", uiStatus.interaction.phase);
  
  // 6. Make intelligent decisions based on system state
  if (uiStatus.interaction.phase === 'conversation') {
    await callTool('xplus1-mcp-machine', 'select_agent', {
      agentId: 'ApoloBot',
      reason: 'System is stable, choosing positive agent for advancement'
    });
  }
  
  console.log("🎯 AI agent in full control of system and game!");
}
```

This guide enables AI agents to become **intelligent DevOps controllers** that can manage the entire application lifecycle while playing the X+1 game strategically! 🚀

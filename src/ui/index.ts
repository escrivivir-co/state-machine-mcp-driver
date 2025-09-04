/**
 * UI Module Exports
 */

// Base UI classes
export { 
  GamificationUI, 
  BaseGamificationUIConfig, 
  GameMessage, 
  GameThread,
  UIPhase,
  GamificationUIEvent 
} from './GamificationUI';

// Console UI
export { 
  ConsoleGamificationUI 
} from './ConsoleGamificationUI';

// HTML5 Web UI
export { 
  HTML5GamificationUI, 
  HTML5GameUIConfig,
  WebClient,
  WebEventData
} from './HTML5GamificationUI';

// ThreeJS Web UI
export { 
  ThreeJSGamificationUI, 
  ThreeJSGameUIConfig
} from './ThreeJSGamificationUI';

// Unity WebGL UI
export { 
  UnityGamificationUI, 
  UnityGameUIConfig
} from './UnityGamificationUI';

// Node-RED Web UI
export { 
  NodeRedGamificationUI
} from './NodeRedGamificationUI';

// WebRTC Web UI
export { 
  WebRTCGamificationUI, 
  WebRTCGameUIConfig,
  WebRTCPeer,
  WebRTCRoom,
  WebRTCSignalingMessage
} from './WebRTCGamificationUI';

// Interface definitions
export { IConsoleReader } from './IConsoleReader';
export { IWebGameUI } from './IWebGameUI';

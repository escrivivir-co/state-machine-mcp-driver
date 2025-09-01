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

// Interface definitions
export { IConsoleReader } from './IConsoleReader';
export { IWebGameUI } from './IWebGameUI';

using UnityEngine;
using SocketIOClient;
using System;
using System.Collections.Generic;
using Newtonsoft.Json;
using System.Threading.Tasks;

namespace AlephScriptUnity
{
    /// <summary>
    /// Unity WebGL integration with AlephScript Multi-UI system
    /// Handles communication between Unity and the Node.js backend
    /// </summary>
    public class UnityAlephScriptClient : MonoBehaviour
    {
        [Header("Connection Settings")]
        public string alephScriptUrl = "http://localhost:3000";
        public string namespacePath = "/runtime";
        public string instanceId;
        
        [Header("Unity Config")]
        public Transform botContainer;
        public GameObject botPrefab;
        public Camera mainCamera;
        
        [Header("Debug")]
        public bool enableDebugLogs = true;
        
        // Socket.IO client
        private SocketIOUnity socket;
        private bool isConnected = false;
        
        // Bot management
        private Dictionary<string, GameObject> activeBots = new Dictionary<string, GameObject>();
        private Dictionary<string, BotData> botConfigurations = new Dictionary<string, BotData>();
        
        // Events
        public static event Action<string> OnMessageReceived;
        public static event Action<NotificationData> OnNotificationReceived;
        public static event Action<string> OnPhaseChanged;
        public static event Action<List<BotData>> OnBotsConfigured;

        void Start()
        {
            // Generate unique instance ID
            instanceId = $"Unity_{SystemInfo.deviceUniqueIdentifier}_{UnityEngine.Random.Range(1000, 9999)}";
            
            InitializeConnection();
        }

        void InitializeConnection()
        {
            try
            {
                // Initialize Socket.IO connection
                var uri = new Uri($"{alephScriptUrl}{namespacePath}");
                socket = new SocketIOUnity(uri);
                
                SetupEventHandlers();
                ConnectAsync();
                
                DebugLog($"Initializing connection to {alephScriptUrl}{namespacePath}");
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to initialize AlephScript connection: {e.Message}");
            }
        }

        async void ConnectAsync()
        {
            try
            {
                await socket.ConnectAsync();
                isConnected = true;
                DebugLog("Connected to AlephScript runtime");
                
                // Notify backend that Unity instance is ready
                await EmitUnityInstanceReady();
                
                // Request initial bot configuration
                await RequestBotConfiguration();
            }
            catch (Exception e)
            {
                Debug.LogError($"Connection failed: {e.Message}");
                isConnected = false;
            }
        }

        void SetupEventHandlers()
        {
            // Core connection events
            socket.OnConnected += (sender, e) => {
                DebugLog("Socket connected");
                isConnected = true;
            };
            
            socket.OnDisconnected += (sender, e) => {
                DebugLog("Socket disconnected");
                isConnected = false;
            };

            // Unity-specific events (from backend)
            socket.On("unity_message", OnUnityMessage);
            socket.On("unity_notification", OnUnityNotification);
            socket.On("unity_phase_change", OnUnityPhaseChange);
            socket.On("unity_bot_configuration", OnUnityBotConfiguration);
            socket.On("unity_state_display", OnUnityStateDisplay);
            
            // System events (forwarded from other UIs)
            socket.On("SYS_HEALTH_CHECK", OnSystemHealthCheck);
            socket.On("SYS_ERROR", OnSystemError);
            socket.On("SYS_WARNING", OnSystemWarning);
        }

        #region Event Handlers

        void OnUnityMessage(SocketIOResponse response)
        {
            try
            {
                var messageData = JsonConvert.DeserializeObject<MessageData>(response.GetValue().GetRawText());
                DebugLog($"Received message from bot {messageData.botId}: {messageData.message}");
                
                // Display message in Unity UI
                DisplayMessage(messageData);
                
                OnMessageReceived?.Invoke(messageData.message);
            }
            catch (Exception e)
            {
                Debug.LogError($"Error handling unity_message: {e.Message}");
            }
        }

        void OnUnityNotification(SocketIOResponse response)
        {
            try
            {
                var notification = JsonConvert.DeserializeObject<NotificationData>(response.GetValue().GetRawText());
                DebugLog($"Notification: {notification.title} - {notification.message}");
                
                DisplayNotification(notification);
                OnNotificationReceived?.Invoke(notification);
            }
            catch (Exception e)
            {
                Debug.LogError($"Error handling unity_notification: {e.Message}");
            }
        }

        void OnUnityPhaseChange(SocketIOResponse response)
        {
            try
            {
                var phaseData = JsonConvert.DeserializeObject<PhaseChangeData>(response.GetValue().GetRawText());
                DebugLog($"Phase changed to: {phaseData.phase}");
                
                HandlePhaseChange(phaseData.phase);
                OnPhaseChanged?.Invoke(phaseData.phase);
            }
            catch (Exception e)
            {
                Debug.LogError($"Error handling unity_phase_change: {e.Message}");
            }
        }

        void OnUnityBotConfiguration(SocketIOResponse response)
        {
            try
            {
                var configData = JsonConvert.DeserializeObject<BotConfigurationData>(response.GetValue().GetRawText());
                DebugLog($"Received bot configuration: {configData.bots.Count} bots");
                
                ConfigureBots(configData.bots);
                OnBotsConfigured?.Invoke(configData.bots);
            }
            catch (Exception e)
            {
                Debug.LogError($"Error handling unity_bot_configuration: {e.Message}");
            }
        }

        void OnUnityStateDisplay(SocketIOResponse response)
        {
            try
            {
                var stateData = JsonConvert.DeserializeObject<StateDisplayData>(response.GetValue().GetRawText());
                DebugLog($"State display: {stateData.level} - {stateData.message}");
                
                // Handle state display in Unity UI
                DisplayStateMessage(stateData);
            }
            catch (Exception e)
            {
                Debug.LogError($"Error handling unity_state_display: {e.Message}");
            }
        }

        void OnSystemHealthCheck(SocketIOResponse response)
        {
            DebugLog("System health check received");
            // Handle system health information
        }

        void OnSystemError(SocketIOResponse response)
        {
            var error = response.GetValue().GetRawText();
            Debug.LogError($"System error: {error}");
        }

        void OnSystemWarning(SocketIOResponse response)
        {
            var warning = response.GetValue().GetRawText();
            Debug.LogWarning($"System warning: {warning}");
        }

        #endregion

        #region Unity Backend Communication

        public async Task SendUserInput(string input)
        {
            if (!isConnected) return;
            
            var inputData = new
            {
                input = input,
                instanceId = instanceId
            };
            
            await socket.EmitAsync("unity_user_input", inputData);
            DebugLog($"Sent user input: {input}");
        }

        public async Task SelectAgent(int agentIndex)
        {
            if (!isConnected) return;
            
            var selectionData = new
            {
                index = agentIndex,
                instanceId = instanceId
            };
            
            await socket.EmitAsync("unity_agent_selection", selectionData);
            DebugLog($"Selected agent at index: {agentIndex}");
        }

        public async Task SendGameEvent(string eventType, object payload)
        {
            if (!isConnected) return;
            
            var eventData = new
            {
                eventType = eventType,
                payload = payload,
                instanceId = instanceId
            };
            
            await socket.EmitAsync("unity_game_event", eventData);
            DebugLog($"Sent game event: {eventType}");
        }

        public async Task SendObjectInteraction(string objectId, string interactionType, Vector3? position = null)
        {
            if (!isConnected) return;
            
            var interactionData = new
            {
                objectId = objectId,
                interactionType = interactionType,
                position = position?.ToAlephVector3(),
                instanceId = instanceId
            };
            
            await socket.EmitAsync("unity_object_interaction", interactionData);
            DebugLog($"Object interaction: {objectId} - {interactionType}");
        }

        private async Task EmitUnityInstanceReady()
        {
            var readyData = new
            {
                instanceId = instanceId,
                unityVersion = Application.unityVersion
            };
            
            await socket.EmitAsync("unity_instance_ready", readyData);
        }

        private async Task RequestBotConfiguration()
        {
            var requestData = new
            {
                instanceId = instanceId
            };
            
            await socket.EmitAsync("unity_request_bot_configuration", requestData);
        }

        #endregion

        #region Unity UI Methods

        void DisplayMessage(MessageData messageData)
        {
            // Update Unity UI to show the message
            // This could be a chat panel, floating text, or bot animation
            
            if (activeBots.ContainsKey(messageData.botId))
            {
                var botObject = activeBots[messageData.botId];
                var botScript = botObject.GetComponent<UnityBot>();
                botScript?.DisplayMessage(messageData.message);
            }
        }

        void DisplayNotification(NotificationData notification)
        {
            // Show notification in Unity UI
            // Could be a popup, toast, or overlay
            Debug.Log($"📢 {notification.title}: {notification.message}");
        }

        void HandlePhaseChange(string phase)
        {
            // Update Unity scene based on game phase
            switch (phase.ToLower())
            {
                case "menu":
                    // Show main menu
                    break;
                case "game":
                    // Enter gameplay mode
                    break;
                case "postulation":
                    // Show agent selection UI
                    break;
                case "complete":
                    // Show completion screen
                    break;
            }
        }

        void ConfigureBots(List<BotData> bots)
        {
            // Clear existing bots
            foreach (var bot in activeBots.Values)
            {
                if (bot != null) Destroy(bot);
            }
            activeBots.Clear();
            botConfigurations.Clear();

            // Create new bots
            foreach (var botData in bots)
            {
                CreateBot(botData);
            }
        }

        void CreateBot(BotData botData)
        {
            if (botPrefab == null || botContainer == null) return;

            // Instantiate bot GameObject
            var botObject = Instantiate(botPrefab, botContainer);
            botObject.name = $"Bot_{botData.name}";
            
            // Position bot
            var position = new Vector3(
                botData.position.x,
                botData.position.y,
                botData.position.z
            );
            botObject.transform.position = position;
            
            // Configure bot appearance based on unityConfig
            var botScript = botObject.GetComponent<UnityBot>();
            if (botScript != null)
            {
                botScript.Configure(botData);
            }
            
            // Store references
            activeBots[botData.id] = botObject;
            botConfigurations[botData.id] = botData;
            
            DebugLog($"Created bot: {botData.name} at position {position}");
        }

        void DisplayStateMessage(StateDisplayData stateData)
        {
            // Handle state display in Unity
            Debug.Log($"State: {stateData.level} - {stateData.message}");
        }

        #endregion

        #region Performance Monitoring

        void Update()
        {
            // Send performance reports periodically
            if (Time.frameCount % 300 == 0) // Every 5 seconds at 60fps
            {
                SendPerformanceReport();
            }
        }

        async void SendPerformanceReport()
        {
            if (!isConnected) return;
            
            var performanceData = new
            {
                fps = Mathf.RoundToInt(1.0f / Time.smoothDeltaTime),
                memoryUsage = UnityEngine.Profiling.Profiler.GetTotalAllocatedMemory(false) / (1024 * 1024), // MB
                instanceId = instanceId
            };
            
            await socket.EmitAsync("unity_performance_report", performanceData);
        }

        #endregion

        #region Utility

        void DebugLog(string message)
        {
            if (enableDebugLogs)
            {
                Debug.Log($"[AlephScript] {message}");
            }
        }

        void OnDestroy()
        {
            if (socket != null && isConnected)
            {
                var disconnectData = new { instanceId = instanceId };
                socket.EmitAsync("unity_instance_disconnect", disconnectData);
                socket.Disconnect();
            }
        }

        #endregion
    }

    #region Data Classes

    [Serializable]
    public class MessageData
    {
        public string botId;
        public string message;
        public string type;
        public AgentData agent;
        public object metadata;
        public long timestamp;
    }

    [Serializable]
    public class NotificationData
    {
        public string title;
        public string message;
        public string type; // info, success, warning, error
        public long timestamp;
    }

    [Serializable]
    public class PhaseChangeData
    {
        public string phase;
        public long timestamp;
    }

    [Serializable]
    public class BotConfigurationData
    {
        public List<BotData> bots;
        public long timestamp;
        public string instanceId;
        public WorldConfig worldConfig;
    }

    [Serializable]
    public class BotData
    {
        public string id;
        public string name;
        public string status;
        public string role;
        public string room;
        public AlephVector3 position;
        public UnityConfig unityConfig;
        public int spiralIndex;
        public int messageActivity;
        public long lastSeen;
    }

    [Serializable]
    public class UnityConfig
    {
        public string prefabName;
        public AlephVector3 scale;
        public string color;
        public string animation;
    }

    [Serializable]
    public class WorldConfig
    {
        public string environment;
        public string lighting;
        public AlephVector3 cameraPosition;
    }

    [Serializable]
    public class AlephVector3
    {
        public float x, y, z;
        
        public Vector3 ToUnityVector3()
        {
            return new Vector3(x, y, z);
        }
    }

    [Serializable]
    public class AgentData
    {
        public string id;
        public string name;
        public string role;
        public string avatar;
    }

    [Serializable]
    public class StateDisplayData
    {
        public string level;
        public string message;
        public long ts;
    }

    #endregion
}

// Extension methods
public static class Vector3Extensions
{
    public static AlephScriptUnity.AlephVector3 ToAlephVector3(this Vector3 vector)
    {
        return new AlephScriptUnity.AlephVector3
        {
            x = vector.x,
            y = vector.y,
            z = vector.z
        };
    }
}

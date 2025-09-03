using UnityEngine;
using UnityEngine.UI;
using System.Collections;
using TMPro;

namespace AlephScriptUnity
{
    /// <summary>
    /// Individual bot behavior in Unity 3D scene
    /// Handles bot appearance, animations, and interactions
    /// </summary>
    public class UnityBot : MonoBehaviour
    {
        [Header("Bot Components")]
        public TextMeshPro nameLabel;
        public SpriteRenderer botRenderer;
        public Animator botAnimator;
        public GameObject messagePopup;
        public TextMeshPro messageText;
        
        [Header("Interaction")]
        public float interactionRange = 3f;
        public LayerMask playerLayer = 1;
        
        // Bot data
        private BotData botData;
        private bool isSelected = false;
        private bool isActive = false;
        private Color originalColor;
        
        // Animation states
        private const string IDLE_ANIMATION = "idle";
        private const string TALKING_ANIMATION = "talking";
        private const string SELECTED_ANIMATION = "selected";
        
        // Message display
        private Coroutine messageDisplayCoroutine;

        public BotData BotData => botData;
        public bool IsSelected => isSelected;
        public bool IsActive => isActive;

        void Start()
        {
            // Initialize components
            if (botRenderer != null)
            {
                originalColor = botRenderer.color;
            }
            
            // Hide message popup initially
            if (messagePopup != null)
            {
                messagePopup.SetActive(false);
            }
            
            // Setup interaction detection
            SetupInteractionTrigger();
        }

        public void Configure(BotData data)
        {
            botData = data;
            
            // Set name
            if (nameLabel != null)
            {
                nameLabel.text = data.name;
            }
            
            // Set color
            if (botRenderer != null && !string.IsNullOrEmpty(data.unityConfig.color))
            {
                if (ColorUtility.TryParseHtmlString(data.unityConfig.color, out Color newColor))
                {
                    botRenderer.color = newColor;
                    originalColor = newColor;
                }
            }
            
            // Set scale
            if (data.unityConfig.scale != null)
            {
                transform.localScale = data.unityConfig.scale.ToUnityVector3();
            }
            
            // Set initial animation
            if (botAnimator != null && !string.IsNullOrEmpty(data.unityConfig.animation))
            {
                botAnimator.Play(data.unityConfig.animation);
            }
            
            // Set as active
            isActive = data.status == "active";
            UpdateVisualState();
        }

        public void DisplayMessage(string message)
        {
            if (messageDisplayCoroutine != null)
            {
                StopCoroutine(messageDisplayCoroutine);
            }
            
            messageDisplayCoroutine = StartCoroutine(ShowMessageCoroutine(message));
        }

        IEnumerator ShowMessageCoroutine(string message)
        {
            // Show message popup
            if (messagePopup != null && messageText != null)
            {
                messageText.text = message;
                messagePopup.SetActive(true);
                
                // Position popup above bot
                var popupPos = transform.position + Vector3.up * 2f;
                messagePopup.transform.position = popupPos;
            }
            
            // Play talking animation
            if (botAnimator != null)
            {
                botAnimator.Play(TALKING_ANIMATION);
            }
            
            // Wait for message duration (based on message length)
            float displayDuration = Mathf.Clamp(message.Length * 0.1f, 2f, 8f);
            yield return new WaitForSeconds(displayDuration);
            
            // Hide message popup
            if (messagePopup != null)
            {
                messagePopup.SetActive(false);
            }
            
            // Return to idle animation
            if (botAnimator != null)
            {
                botAnimator.Play(isSelected ? SELECTED_ANIMATION : IDLE_ANIMATION);
            }
            
            messageDisplayCoroutine = null;
        }

        public void SetSelected(bool selected)
        {
            isSelected = selected;
            UpdateVisualState();
            
            if (botAnimator != null)
            {
                botAnimator.Play(selected ? SELECTED_ANIMATION : IDLE_ANIMATION);
            }
        }

        public void SetActive(bool active)
        {
            isActive = active;
            UpdateVisualState();
        }

        void UpdateVisualState()
        {
            if (botRenderer == null) return;
            
            if (!isActive)
            {
                // Inactive bot - grayed out
                botRenderer.color = Color.gray;
                if (nameLabel != null)
                {
                    nameLabel.color = Color.gray;
                }
            }
            else if (isSelected)
            {
                // Selected bot - highlighted
                botRenderer.color = Color.yellow;
                if (nameLabel != null)
                {
                    nameLabel.color = Color.white;
                }
            }
            else
            {
                // Normal active bot
                botRenderer.color = originalColor;
                if (nameLabel != null)
                {
                    nameLabel.color = Color.white;
                }
            }
        }

        void SetupInteractionTrigger()
        {
            // Add a collider for interaction if not present
            if (GetComponent<Collider>() == null)
            {
                var collider = gameObject.AddComponent<SphereCollider>();
                collider.isTrigger = true;
                collider.radius = interactionRange;
            }
        }

        void OnMouseDown()
        {
            // Handle bot click/selection
            OnBotClicked();
        }

        void OnTriggerEnter(Collider other)
        {
            // Handle player proximity
            if (IsPlayerObject(other))
            {
                OnPlayerNear(true);
            }
        }

        void OnTriggerExit(Collider other)
        {
            if (IsPlayerObject(other))
            {
                OnPlayerNear(false);
            }
        }

        bool IsPlayerObject(Collider other)
        {
            return (playerLayer.value & (1 << other.gameObject.layer)) != 0;
        }

        void OnBotClicked()
        {
            if (!isActive) return;
            
            // Find the AlephScript client and notify of selection
            var alephClient = FindObjectOfType<UnityAlephScriptClient>();
            if (alephClient != null && botData != null)
            {
                // Find bot index from current configuration
                int botIndex = FindBotIndex();
                if (botIndex >= 0)
                {
                    alephClient.SelectAgent(botIndex);
                }
            }
            
            // Visual feedback
            StartCoroutine(ClickFeedback());
        }

        int FindBotIndex()
        {
            // This would need to be implemented based on how bots are tracked
            // For now, return a placeholder
            return botData?.spiralIndex ?? -1;
        }

        IEnumerator ClickFeedback()
        {
            // Quick scale animation to show click feedback
            var originalScale = transform.localScale;
            var targetScale = originalScale * 1.1f;
            
            // Scale up
            float elapsed = 0f;
            float duration = 0.1f;
            
            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / duration;
                transform.localScale = Vector3.Lerp(originalScale, targetScale, t);
                yield return null;
            }
            
            // Scale back down
            elapsed = 0f;
            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / duration;
                transform.localScale = Vector3.Lerp(targetScale, originalScale, t);
                yield return null;
            }
            
            transform.localScale = originalScale;
        }

        void OnPlayerNear(bool isNear)
        {
            // Handle player proximity events
            if (isNear && isActive)
            {
                // Show interaction hint or highlight
                if (botRenderer != null)
                {
                    botRenderer.color = Color.Lerp(originalColor, Color.white, 0.3f);
                }
            }
            else
            {
                // Remove highlight
                UpdateVisualState();
            }
        }

        // Integration with game events
        public void OnGameEvent(string eventType, object payload)
        {
            switch (eventType.ToLower())
            {
                case "agent_postulation":
                    // Bot is available for selection
                    StartCoroutine(PostulationAnimation());
                    break;
                    
                case "agent_activated":
                    SetActive(true);
                    break;
                    
                case "agent_deactivated":
                    SetActive(false);
                    break;
                    
                case "message_sent":
                    // Bot sent a message, play send animation
                    if (botAnimator != null)
                    {
                        botAnimator.Play("message_send");
                    }
                    break;
            }
        }

        IEnumerator PostulationAnimation()
        {
            // Subtle bounce animation to indicate bot is available
            for (int i = 0; i < 3; i++)
            {
                transform.position += Vector3.up * 0.1f;
                yield return new WaitForSeconds(0.2f);
                transform.position -= Vector3.up * 0.1f;
                yield return new WaitForSeconds(0.2f);
            }
        }

        void OnDrawGizmosSelected()
        {
            // Show interaction range in scene view
            Gizmos.color = Color.yellow;
            Gizmos.DrawWireSphere(transform.position, interactionRange);
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const backButton = document.getElementById('back-button');
  const saveSettingsBtn = document.getElementById('save-settings');
  const resetSettingsBtn = document.getElementById('reset-settings');
  const statusMessage = document.getElementById('status-message');
  
  // Form elements
  const dailyFollowLimit = document.getElementById('daily-follow-limit');
  const hourlyFollowLimit = document.getElementById('hourly-follow-limit');
  const maxActionsSession = document.getElementById('max-actions-session');
  const followInterval = document.getElementById('follow-interval');
  const unfollowDays = document.getElementById('unfollow-days');
  const unfollowSeconds = document.getElementById('unfollow-seconds');
  const timeVariance = document.getElementById('time-variance');
  const varianceValue = document.getElementById('variance-value');
  const enableAutoFollow = document.getElementById('enable-auto-follow');
  const enableAutoUnfollow = document.getElementById('enable-auto-unfollow');
  const minThinkingTime = document.getElementById('min-thinking-time');
  const maxThinkingTime = document.getElementById('max-thinking-time');
  
  // Default settings
  const defaultSettings = {
    dailyFollowLimit: 50,
    hourlyFollowLimit: 0,
    maxActionsSession: 0,
    followInterval: 60,
    unfollowDays: 3,
    unfollowSeconds: '',
    timeVariance: 20,
    minThinkingTime: 100,
    maxThinkingTime: 500,
    enableAutoFollow: true,
    enableAutoUnfollow: false,
    lastUpdated: null
  };
  
  // Initialize
  init();
  
  // Event listeners
  backButton.addEventListener('click', () => {
    window.location.href = 'popup.html';
  });
  
  saveSettingsBtn.addEventListener('click', saveSettings);
  resetSettingsBtn.addEventListener('click', resetSettings);
  
  // Update variance value display when slider changes
  timeVariance.addEventListener('input', function() {
    varianceValue.textContent = this.value + '%';
  });
  
  // Functions
  async function init() {
    await loadSettings();
  }
  
  async function loadSettings() {
    try {
      const data = await chrome.storage.local.get('agentSettings');
      const settings = data.agentSettings || defaultSettings;
      
      // Populate form with saved settings
      dailyFollowLimit.value = settings.dailyFollowLimit;
      hourlyFollowLimit.value = settings.hourlyFollowLimit;
      maxActionsSession.value = settings.maxActionsSession;
      followInterval.value = settings.followInterval;
      unfollowDays.value = settings.unfollowDays;
      unfollowSeconds.value = settings.unfollowSeconds;
      timeVariance.value = settings.timeVariance;
      varianceValue.textContent = settings.timeVariance + '%';
      enableAutoFollow.checked = settings.enableAutoFollow;
      enableAutoUnfollow.checked = settings.enableAutoUnfollow;
      minThinkingTime.value = settings.minThinkingTime;
      maxThinkingTime.value = settings.maxThinkingTime;
      
    } catch (error) {
      console.error('Error loading settings:', error);
      showStatus(`Error loading settings: ${error.message}`, 'error');
    }
  }
  
  async function saveSettings() {
    try {
      // Validate inputs
      const limit = parseInt(dailyFollowLimit.value);
      const interval = parseInt(followInterval.value);
      const days = parseInt(unfollowDays.value);
      const seconds = parseInt(unfollowSeconds.value);
      const variance = parseInt(timeVariance.value);
      
      const hourlyLimit = parseInt(hourlyFollowLimit.value);
      const sessionLimit = parseInt(maxActionsSession.value);
      const minThink = parseInt(minThinkingTime.value);
      const maxThink = parseInt(maxThinkingTime.value);
      
      if (isNaN(limit) || limit < 1 || limit > 500) {
        throw new Error('Daily follow limit must be between 1 and 500');
      }
      
      if (isNaN(interval) || interval < 4 || interval > 3600) {
        throw new Error('Follow interval must be between 4 and 3600 seconds');
      }
      
      if (isNaN(days) || days < 1 || days > 90) {
        throw new Error('Days to unfollow must be between 1 and 90');
      }
      
      if (isNaN(seconds) || seconds < 0 || seconds > 3600) {
        throw new Error('Unfollow seconds must be between 0 and 3600');
      }
      
      if (isNaN(variance) || variance < 0 || variance > 50) {
        throw new Error('Time variance must be between 0% and 50%');
      }
      
      if (isNaN(hourlyLimit) || hourlyLimit < 0 || hourlyLimit > 100) {
        throw new Error('Hourly follow limit must be between 0 and 100');
      }
      
      if (isNaN(sessionLimit) || sessionLimit < 0 || sessionLimit > 1000) {
        throw new Error('Max actions per session must be between 0 and 1000');
      }
      
      if (isNaN(minThink) || minThink < 0 || minThink > 2000) {
        throw new Error('Min thinking time must be between 0 and 2000ms');
      }
      
      if (isNaN(maxThink) || maxThink < minThink || maxThink > 3000) {
        throw new Error('Max thinking time must be between min value and 3000ms');
      }
      
      // Create settings object
      const settings = {
        dailyFollowLimit: limit,
        hourlyFollowLimit: hourlyLimit,
        maxActionsSession: sessionLimit,
        followInterval: interval,
        unfollowDays: days,
        unfollowSeconds: seconds,
        timeVariance: variance,
        minThinkingTime: minThink,
        maxThinkingTime: maxThink,
        enableAutoFollow: enableAutoFollow.checked,
        enableAutoUnfollow: enableAutoUnfollow.checked,
        lastUpdated: new Date().toISOString()
      };
      
      // Save to storage
      await chrome.storage.local.set({ agentSettings: settings });
      
      showStatus('Settings saved successfully', 'success');
    } catch (error) {
      console.error('Error saving settings:', error);
      showStatus(`Error: ${error.message}`, 'error');
    }
  }
  
  async function resetSettings() {
    try {
      // Reset form to default values
      dailyFollowLimit.value = defaultSettings.dailyFollowLimit;
      hourlyFollowLimit.value = defaultSettings.hourlyFollowLimit;
      maxActionsSession.value = defaultSettings.maxActionsSession;
      followInterval.value = defaultSettings.followInterval;
      unfollowDays.value = defaultSettings.unfollowDays;
      unfollowSeconds.value = defaultSettings.unfollowSeconds;
      timeVariance.value = defaultSettings.timeVariance;
      varianceValue.textContent = defaultSettings.timeVariance + '%';
      enableAutoFollow.checked = defaultSettings.enableAutoFollow;
      enableAutoUnfollow.checked = defaultSettings.enableAutoUnfollow;
      minThinkingTime.value = defaultSettings.minThinkingTime;
      maxThinkingTime.value = defaultSettings.maxThinkingTime;
      
      // Save default settings
      await chrome.storage.local.set({ agentSettings: { ...defaultSettings, lastUpdated: new Date().toISOString() } });
      
      showStatus('Settings reset to default values', 'success');
    } catch (error) {
      console.error('Error resetting settings:', error);
      showStatus(`Error: ${error.message}`, 'error');
    }
  }
  
  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status ${type}`;
    statusMessage.classList.remove('hidden');
    
    // Auto-hide success messages after 3 seconds
    if (type === 'success') {
      setTimeout(() => {
        statusMessage.classList.add('hidden');
      }, 3000);
    }
  }
}); 
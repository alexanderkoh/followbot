/**
 * Content Script Detector
 * This script can be injected to check if the content script is loaded and working properly
 */

(function() {
  const isContentScriptLoaded = window.hasOwnProperty('xGrowthAgentLoaded');
  
  // Create a small notification
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background-color: ${isContentScriptLoaded ? 'rgba(23, 191, 99, 0.9)' : 'rgba(224, 36, 94, 0.9)'};
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 13px;
    z-index: 9999;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  `;
  
  notification.textContent = isContentScriptLoaded 
    ? '✅ X Growth Agent content script is loaded' 
    : '❌ X Growth Agent content script is NOT loaded';
  
  document.body.appendChild(notification);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    notification.remove();
  }, 5000);
  
  // Return the result to the caller
  return isContentScriptLoaded;
})(); 
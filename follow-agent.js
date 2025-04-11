/**
 * X Growth Agent - Follow Agent
 * 
 * This script handles automatic following and unfollowing of users based on settings
 */

// Ensure this specific script only loads once to avoid duplicating functions
if (typeof window.xGrowthAgentFollowAgentLoaded !== 'undefined') {
  console.log('Follow agent already loaded, aborting duplicate initialization');
} else {
  // Set global flag immediately to prevent duplicate execution
  window.xGrowthAgentFollowAgentLoaded = true;
  console.log('X Growth Agent follow agent script loading...');

  // These functions need to be exposed to the window object for direct access
  // Define them at the top level to ensure they're available early
  window.startAgent = null; // Will be defined later
  window.stopAgent = null;  // Will be defined later
  window.getAgentStatus = null; // Will be defined later

  // Add timestamp for debugging
  window.followAgentLoadTime = new Date().toISOString();
  console.log('X Growth Agent follow agent script loaded on', window.location.href);

  // --- STATE MACHINE STATE ---
  // We rely more heavily on chrome.storage.local now, but keep a minimal
  // in-memory copy for functions that don't need immediate storage access.
  let agentStateInMemory = {
      isRunning: false, // Read from storage on page load
      currentUser: null, // Read from storage on page load
      consecutiveErrors: 0 // Track errors for the current session
  };

  // Debug logging system (remains the same)
  let logEntries = [];
  let debugVisible = false;
  let debugContainer = null;

  // Define agent functions in a scope that won't conflict with content.js
  (function initializeAgent() {
    
    // --- Helper for random delays ---
    function randomDelay(min, max) {
      if (min === 0 && max === 0) return Promise.resolve(); // No delay if both are 0
      const delay = Math.floor(Math.random() * (max - min + 1)) + min;
      logDebug(`Applying random delay: ${delay}ms (range: ${min}-${max})`, 'info');
      return new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // --- DEBUG & UI FUNCTIONS (Unchanged) ---
    /**
     * Initialize debug logger interface
     */
    function initDebugLogger() {
      // Check if the agent overlay exists first, if not create it
      let agentOverlayElem = document.getElementById('x-growth-agent-overlay');
      if (!agentOverlayElem) {
        agentOverlayElem = createAgentOverlay('Debug mode activated');
      }
      
      // Create debug container if it doesn't exist
      if (!debugContainer) {
        // Create a wrapper inside the agent overlay
        const debugWrapper = document.createElement('div');
        debugWrapper.id = 'x-growth-agent-debug-wrapper';
        debugWrapper.style.cssText = `
          margin-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.2);
          padding-top: 10px;
          width: 100%;
          display: flex;
          flex-direction: column;
        `;
        
        // Add header with toggle button
        const debugHeader = document.createElement('div');
        debugHeader.style.cssText = `
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        `;
        
        // Title
        const debugTitle = document.createElement('div');
        debugTitle.textContent = 'Debug Log';
        debugTitle.style.fontWeight = 'bold';
        
        // Toggle button
        const toggleButton = document.createElement('button');
        toggleButton.id = 'x-growth-agent-debug-toggle';
        toggleButton.textContent = 'Hide Log';
        toggleButton.style.cssText = `
          background-color: rgba(0, 0, 0, 0.3);
          color: white;
          border: none;
          border-radius: 4px;
          padding: 4px 8px;
          font-size: 12px;
          cursor: pointer;
        `;
        
        // Add event listener to toggle debug log visibility
        toggleButton.addEventListener('click', () => {
          const logContainer = document.getElementById('x-growth-agent-debug-log');
          if (logContainer) {
            const isVisible = logContainer.style.display !== 'none';
            toggleDebugVisibility(!isVisible);
          }
        });
        
        debugHeader.appendChild(debugTitle);
        debugHeader.appendChild(toggleButton);
        
        // Create log container
        debugContainer = document.createElement('div');
        debugContainer.id = 'x-growth-agent-debug-log';
        debugContainer.style.cssText = `
          background-color: rgba(0, 0, 0, 0.2);
          border-radius: 4px;
          padding: 8px;
          max-height: 200px;
          overflow-y: auto;
          font-family: monospace;
          font-size: 12px;
          margin-bottom: 10px;
        `;
        
        // Add controls
        const debugControls = document.createElement('div');
        debugControls.style.cssText = `
          display: flex;
          gap: 8px;
        `;
        
        // Test follow button
        const testFollowButton = document.createElement('button');
        testFollowButton.textContent = 'Test Follow Button';
        testFollowButton.style.cssText = `
          background-color: #ff4500;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 4px 8px;
          font-size: 12px;
          cursor: pointer;
          flex: 1;
        `;
        
        testFollowButton.addEventListener('click', () => {
          if (typeof window.testFindFollowButton === 'function') {
            window.testFindFollowButton();
          }
        });
        
        // Clear log button
        const clearLogButton = document.createElement('button');
        clearLogButton.textContent = 'Clear Log';
        clearLogButton.style.cssText = `
          background-color: rgba(0, 0, 0, 0.3);
          color: white;
          border: none;
          border-radius: 4px;
          padding: 4px 8px;
          font-size: 12px;
          cursor: pointer;
          flex: 1;
        `;
        
        clearLogButton.addEventListener('click', clearDebugLog);
        
        debugControls.appendChild(testFollowButton);
        debugControls.appendChild(clearLogButton);
        
        // Assemble debug UI
        debugWrapper.appendChild(debugHeader);
        debugWrapper.appendChild(debugContainer);
        debugWrapper.appendChild(debugControls);
        
        // Add to agent overlay
        agentOverlayElem.appendChild(debugWrapper);
        
        // Add debug toggle button to the main overlay as well
        const debugToggleBtn = document.createElement('button');
        debugToggleBtn.id = 'x-growth-agent-debug-toggle-btn';
        debugToggleBtn.textContent = '🐞';
        debugToggleBtn.title = 'Toggle debug log';
        debugToggleBtn.style.cssText = `
          position: absolute;
          top: 12px;
          right: 12px;
          background-color: #ff4500;
          color: white;
          border: none;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        `;
        
        // Add event listener to toggle the entire debug wrapper
        debugToggleBtn.addEventListener('click', () => {
          const wrapper = document.getElementById('x-growth-agent-debug-wrapper');
          if (wrapper) {
            const isVisible = wrapper.style.display !== 'none';
            wrapper.style.display = isVisible ? 'none' : 'flex';
            
            // If making visible, also make sure the log is visible
            if (!isVisible) {
              toggleDebugVisibility(true);
            }
          }
        });
        
        // Add to overlay if not already present
        if (!document.getElementById('x-growth-agent-debug-toggle-btn')) {
          agentOverlayElem.appendChild(debugToggleBtn);
        }
        
        // Start with log hidden but wrapper visible
        toggleDebugVisibility(false);
      }
      
      // Log initial message
      logDebug('Debug logger initialized', 'info');
      
      return debugContainer;
    }
    
    /**
     * Logs a debug message to both the debug UI and console
     */
    function logDebug(message, type = 'info', data = null) {
      // Add timestamp
      const timestamp = new Date().toLocaleTimeString();
      const logMsg = `[${timestamp}] ${message}`;
      
      // Log to console with appropriate styling
      if (data) {
        switch(type) {
          case 'error':
            console.error(logMsg, data);
            break;
          case 'warning':
            console.warn(logMsg, data);
            break;
          case 'success':
            console.log('%c' + logMsg, 'color: #17bf63', data);
            break;
          default:
            console.log(logMsg, data);
        }
      } else {
        switch(type) {
          case 'error':
            console.error(logMsg);
            break;
          case 'warning':
            console.warn(logMsg);
            break;
          case 'success':
            console.log('%c' + logMsg, 'color: #17bf63');
            break;
          default:
            console.log(logMsg);
        }
      }
      
      // Only continue if debug container exists
      if (!debugContainer) return;
      
      // Create log entry
      const logEntry = document.createElement('div');
      logEntry.style.cssText = `
        padding: 4px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        word-break: break-word;
        font-size: 12px;
      `;
      
      // Set color based on type
      switch(type) {
        case 'error':
          logEntry.style.color = '#ff4d4d';
          break;
        case 'warning':
          logEntry.style.color = '#ffcc00';
          break;
        case 'success':
          logEntry.style.color = '#17bf63';
          break;
        default:
          logEntry.style.color = '#ffffff';
      }
      
      // Create message element
      logEntry.textContent = logMsg;
      
      // Add data section if provided
      if (data) {
        const dataEl = document.createElement('div');
        dataEl.style.cssText = `
          padding: 4px 8px;
          margin-top: 4px;
          background-color: rgba(0, 0, 0, 0.2);
          border-radius: 2px;
          font-size: 11px;
          color: #bbbbbb;
          white-space: pre-wrap;
        `;
        
        // Format data based on type
        if (typeof data === 'string') {
          dataEl.textContent = data;
        } else {
          try {
            dataEl.textContent = JSON.stringify(data, null, 2);
          } catch (e) {
            dataEl.textContent = '[Object cannot be stringified]';
          }
        }
        
        logEntry.appendChild(dataEl);
      }
      
      // Add to debug log container
      const logContainer = document.getElementById('x-growth-agent-debug-log');
      if (logContainer) {
        // Add to the top, newest first
        logContainer.insertBefore(logEntry, logContainer.firstChild);
        
        // Limit the number of log entries to prevent excessive DOM growth
        while (logContainer.children.length > 100) {
          logContainer.removeChild(logContainer.lastChild);
        }
      }
      
      // Update debug view
      updateDebugView();
    }
    
    /**
     * Updates the debug view
     */
    function updateDebugView() {
      // No longer needed as logs are added directly to the DOM in logDebug
      // This function is kept for backward compatibility
    }
    
    /**
     * Toggles the visibility of the debug log
     */
    function toggleDebugVisibility(visible) {
      // If direct value provided, use it, otherwise toggle
      if (typeof visible === 'boolean') {
        debugVisible = visible;
      } else {
        debugVisible = !debugVisible;
      }
      
      // Find the debug wrapper
      const debugWrapper = document.getElementById('x-growth-agent-debug-wrapper');
      if (debugWrapper) {
        // Keep wrapper visible, but toggle the debug container
        const debugContainer = document.getElementById('x-growth-agent-debug-log');
        if (debugContainer) {
          debugContainer.style.display = debugVisible ? 'block' : 'none';
        }
        
        // Update toggle button text
        const toggleBtn = document.getElementById('x-growth-agent-debug-toggle');
        if (toggleBtn) {
          toggleBtn.textContent = debugVisible ? 'Hide Log' : 'Show Log';
        }
      }
      
      return debugVisible;
    }
    
    /**
     * Clears the debug log
     */
    function clearDebugLog() {
      // Clear the log container
      const logContainer = document.getElementById('x-growth-agent-debug-log');
      if (logContainer) {
        logContainer.innerHTML = '';
      }
      
      // Add a message showing the log was cleared
      logDebug('Debug log cleared', 'info');
    }

    /**
     * Creates a status overlay on the page to show agent progress
     */
    function createAgentOverlay(message) {
      // Remove existing overlay if any
      removeAgentOverlay();
      
      // Create new overlay
      const overlay = document.createElement('div');
      overlay.id = 'x-growth-agent-overlay';
      overlay.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        width: auto;
        max-width: 400px;
        background-color: rgba(29, 161, 242, 0.9);
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 14px;
        font-weight: 500;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        transition: all 0.3s ease;
      `;
      
      // Add status message with ID
      const statusMessage = document.createElement('div');
      statusMessage.id = 'x-growth-agent-status-message';
      statusMessage.textContent = message;
      statusMessage.style.marginRight = '24px'; // Make room for the debug button
      
      overlay.appendChild(statusMessage);
      document.body.appendChild(overlay);
      
      return overlay;
    }

    /**
     * Updates the agent overlay with a new message
     */
    function updateAgentOverlay(message) {
      const overlay = document.getElementById('x-growth-agent-overlay');
      const statusMessage = document.getElementById('x-growth-agent-status-message');
      
      if (overlay && statusMessage) {
        statusMessage.textContent = message;
      } else {
        createAgentOverlay(message);
      }
      
      // Log the message
      logDebug(`Status: ${message}`);
    }

    /**
     * Removes the agent overlay
     */
    function removeAgentOverlay() {
      const overlay = document.getElementById('x-growth-agent-overlay');
      if (overlay) {
        overlay.remove();
      }
    }

    // --- CORE AGENT ACTIONS (Mostly Unchanged Logic) ---
    /**
     * Find and click the follow button for a specific user
     */
    async function followUser(username) {
        // --- NOTE: Removed navigation from here. It happens *before* this is called. ---
      return new Promise((resolve, reject) => {
        try {
          // --- Removed navigation call ---
          logDebug(`Attempting to follow user @${username} on current page`);
          
          // <<< Get settings for thinking time >>>
          chrome.storage.local.get('agentSettings', async (data) => {
            const settings = data.agentSettings || {};
            const minThink = settings.minThinkingTime || 0;
            const maxThink = settings.maxThinkingTime || 0;

            // <<< DEFINE attempts and maxAttempts HERE >>>
            let attempts = 0;
            const maxAttempts = 15; // Number of times to check for the button before giving up

            // Wait for initial page load (already happened, but keep short delay)
            await new Promise(resolve => setTimeout(resolve, 1000)); // Existing delay
            logDebug('Searching for follow button after delay');

            const intervalId = setInterval(async () => { // Make interval async
              // Check if agent was stopped externally
              if (!agentStateInMemory.isRunning) {
                  logDebug('Agent stopped externally during followUser check.', 'warning');
                  clearInterval(intervalId);
                  reject(new Error('Agent stopped')); // Reject the promise if stopped
              return;
            }
            
              attempts++;
              
              try { // Add try block here
                // First attempt: log detailed diagnostics (unchanged)
            if (attempts === 1) {
                    // ... (unchanged logging)
                }
                
                // Log on each 5th attempt (unchanged)
                if (attempts % 5 === 0 && attempts > 1) {
                  logDebug(`Follow button search attempt #${attempts}`, 'info');
                }
                
                // Follow button detection logic (unchanged)
                let followButton = null;
                // Method 1: NEW - Look for data-testid ending with "-follow" (most reliable in 2024 Twitter UI)
                const followPattern = /\d+-follow$/;
                const potentialButtons = document.querySelectorAll('button[data-testid]');
                if (attempts % 3 === 0) { // Log potential buttons every 3 attempts
                    logDebug(`Attempt ${attempts}: Found ${potentialButtons.length} buttons with data-testid`, 'info', 
                        Array.from(potentialButtons).slice(0,10).map(b => b.getAttribute('data-testid'))
                    );
                }
                
                for (const btn of potentialButtons) {
                  const testId = btn.getAttribute('data-testid');
                  if (testId && followPattern.test(testId)) {
                    logDebug(`Found potential numbered-follow button: ${testId}`, 'info'); // Log match
                    // Skip if it's clearly an unfollow button
                    if (testId.includes('unfollow')) {
                        logDebug(`Skipping ${testId} (contains unfollow)`);
                        continue;
                    }
                      
                    // Skip if button text contains "Following" or "Unfollow"
                    const btnText = btn.textContent?.trim().toLowerCase();
                    if (btnText && (btnText.includes('following') || btnText.includes('unfollow'))) {
                        logDebug(`Skipping ${testId} (text is ${btnText})`);
                        continue;
                    }
                      
                    // Highlight button with highest priority (unchanged)
                    // ...
                    followButton = btn;
                    logDebug(`Selected button ${testId} as followButton`, 'success');
                    break; 
                  }
                }
                
                // If we found a follow button, click it
                if (followButton) {
                  clearInterval(intervalId); // Clear interval on success
                  logDebug('Found follow button - preparing to click', 'success');
                  
                  followButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  
                  await new Promise(resolve => setTimeout(resolve, 800)); // Wait after scroll (existing delay)
                  await randomDelay(minThink, maxThink); // <<< ADD THINKING DELAY >>>

                  try {
                    // ... (Pre-click checks) ...
                    logDebug('Follow button appears visible and enabled.', 'info');

                    followButton.focus();
                    logDebug('Attempted to focus follow button', 'info');

                    await new Promise(resolve => setTimeout(resolve, 300)); // Existing delay
                    await randomDelay(minThink, maxThink); // <<< ADD THINKING DELAY >>>

                    logDebug('Attempting multiple click methods...', 'info');
                    // Try methods sequentially
                    let clickAttempted = false;
                    try {
                        logDebug('Attempting click method 1: Direct click()');
                        followButton.click(); // Direct element click
                        clickAttempted = true;
                        logDebug('Click method 1 attempted.');
                    } catch (e1) {
                         logDebug(`Click method 1 failed: ${e1.message}`, 'warning');
                    }

                    // Add more robust methods if needed later, e.g., dispatching MouseEvents
                    // if (!clickAttempted || /* check if button state changed */ ) { ... }

                    logDebug('Waiting for potential UI update after click attempts...', 'info');
                    await new Promise(resolve => setTimeout(resolve, 1500)); // Existing delay for verification

                    logDebug('Verifying follow action...', 'info');
                    const verificationStatus = await checkFollowStatus(username); // checkFollowStatus should also have delays internally if needed
                    logDebug(`Follow verification result for @${username}:`, 'info', verificationStatus);

                    if (verificationStatus.following) {
                        logDebug('Successfully followed user (verified)', 'success');
                        resolve(true);
                    } else {
                        logDebug('Follow action failed verification (button state did not change as expected)', 'error');
                        resolve(false);
                    }
                  } catch (clickError) {
                     logDebug(`Error during click/verification: ${clickError.message}`, 'error');
                     reject(clickError);
                  }
                  
                  return; // Exit interval callback once button is found
                }
                
                // Error condition checks (unchanged)
                // Account unavailable
                // ...
                // Rate limited
                // ...
                  
                // Stop after max attempts (unchanged)
            if (attempts >= maxAttempts) {
                  clearInterval(intervalId);
                  logDebug(`Max attempts (${maxAttempts}) reached trying to find follow button`, 'error');
                  // ... (snapshot logging)
              reject(new Error(`Could not find follow button for @${username} after ${maxAttempts} attempts`));
            }
              } catch (intervalError) { // Catch errors within the interval
                  logDebug(`Error inside followUser interval for @${username}:`, 'error', intervalError);
                  clearInterval(intervalId);
                  reject(new Error(`Error during button search: ${intervalError.message}`));
              }
            }, 500); // Check every 500ms

            // Overall timeout logic remains the same
            const overallTimeoutId = setTimeout(() => { /* ... */ }, 20000);
          }); // End of chrome.storage.local.get callback
        } catch (error) {
          logDebug(`Error in followUser setup for @${username}: ${error.message}`, 'error');
          reject(error);
        }
      });
    }

    /**
     * Check if we're already following a user
     */
    async function checkFollowStatus(username) {
        // --- NOTE: Removed navigation from here. It happens *before* this is called. ---
      return new Promise((resolve, reject) => {
        let overallTimeoutId = null; // Define timeout ID here
        let intervalId = null;       // Define interval ID here
        
        try {
          // --- Removed navigation call ---
          logDebug(`Checking follow status for @${username} on current page`);
          
          // Wait for page elements to appear
          let attempts = 0;
          const maxAttempts = 40;
          let pageElementsChecked = false;

          // Shorter initial delay as page should be loaded
                setTimeout(() => {
              pageElementsChecked = true;
              logDebug('Checking for follow status elements');
          }, 500); 
          
          intervalId = setInterval(() => { // Assign intervalId here
            // Check if agent was stopped externally
            if (!agentStateInMemory.isRunning) {
                logDebug('Agent stopped externally during checkFollowStatus.', 'warning');
                clearInterval(intervalId);
                clearTimeout(overallTimeoutId); // <<< CLEAR TIMEOUT HERE
                reject(new Error('Agent stopped')); // Reject the promise if stopped
                      return;
                    }
                    
            attempts++;
            
            if (!pageElementsChecked) {
                logDebug('Waiting briefly for page elements...');
                          return;
                        }
                        
            // Wait for document ready (still useful)
            if (!document.body) {
              // ... (unchanged)
            }
            
            // Detection Methods (unchanged logic)
            // Method 1: Following button
            const followingButton = document.querySelector('button[data-testid*="unfollow"]');
            if (followingButton) {
              logDebug('Found unfollow button (following)');
              clearInterval(intervalId);
              clearTimeout(overallTimeoutId); // <<< CLEAR TIMEOUT HERE
              resolve({ following: true });
              return;
            }
            
            // Method 2: Follow button (check both variants)
            const followButtonNum = document.querySelector('button[data-testid$="-follow"]');
            const followButtonStandard = document.querySelector('button[data-testid="user-follow-button"]');
            if (followButtonNum || followButtonStandard) {
              logDebug('Found follow button (not following)');
              clearInterval(intervalId);
              clearTimeout(overallTimeoutId); // <<< CLEAR TIMEOUT HERE
              resolve({ following: false });
              return;
            }

            // Method 3: Header buttons (check for "Following" text)
            const headerButtons = document.querySelectorAll('div[data-testid="primaryColumn"] button span');
            for (const span of headerButtons) {
                if (span.textContent?.trim().toLowerCase() === 'following') {
                    logDebug('Found "Following" text in header buttons');
                    clearInterval(intervalId);
                    clearTimeout(overallTimeoutId); // <<< CLEAR TIMEOUT HERE
                    resolve({ following: true });
                    return;
                }
            }
            
            // Error Cases (unchanged logic)
            // Account unavailable
            // ...
            // Rate limiting
            // ...
            
            // Max attempts (unchanged logic)
            if (attempts >= maxAttempts) {
              logDebug(`Reached max attempts (${maxAttempts}) to determine follow status`);
              clearInterval(intervalId);
              clearTimeout(overallTimeoutId); // <<< CLEAR TIMEOUT HERE
              resolve({ following: false, unsure: true });
              return; // Ensure we exit after resolving
            }
          }, 300); // Faster checks
          
          // Timeout (remains useful)
          overallTimeoutId = setTimeout(() => { // Assign overallTimeoutId here
            clearInterval(intervalId); // Clear interval on timeout too
            logDebug(`Timeout reached for checking follow status of @${username}`);
            resolve({ following: false, timedOut: true });
          }, 20000); // Slightly shorter timeout

        } catch (error) {
          if (intervalId) clearInterval(intervalId); // Ensure cleanup on setup error
          if (overallTimeoutId) clearTimeout(overallTimeoutId); // Ensure cleanup on setup error
          logDebug('Error checking follow status:', error);
          resolve({ following: false, error: true }); // Resolve instead of reject for consistency? Check usage.
        }
      });
    }

    // --- ADDED unfollowUser FUNCTION ---
    async function unfollowUser(username) {
      return new Promise(async (resolve, reject) => { // Make outer function async
        logDebug(`Attempting to unfollow user @${username} on current page`, 'info');
          let attempts = 0;
        const maxAttempts = 15; // Shorter timeout for unfollow attempts

        // <<< Get settings for thinking time >>>
        const settingsData = await chrome.storage.local.get('agentSettings');
        const settings = settingsData.agentSettings || {};
        const minThink = settings.minThinkingTime || 0;
        const maxThink = settings.maxThinkingTime || 0;

        // Find the initial "Following" button
        let followingButton = null;
        const intervalId = setInterval(async () => { // Make interval callback async
          attempts++;
          if (attempts > maxAttempts) {
            clearInterval(intervalId);
            logDebug(`Could not find 'Following' button for @${username} after ${maxAttempts} attempts`, 'error');
            reject(new Error('Could not find Following button'));
              return;
            }
            
          followingButton = document.querySelector('button[data-testid*="unfollow"]');
          if (followingButton) {
            clearInterval(intervalId);
            logDebug(`Found 'Following' button for @${username}.`, 'success');

            try {
              // 1. Click the "Following" button to trigger confirmation
              followingButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
              await new Promise(resolve => setTimeout(resolve, 500)); // Wait after scroll
              await randomDelay(minThink, maxThink); // <<< ADD THINKING DELAY >>>
              logDebug('Clicking initial "Following" button...', 'info');
              followingButton.click();

              // 2. Wait for confirmation dialog and find the confirm button
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for dialog
              logDebug('Searching for confirmation "Unfollow" button...', 'info');
              const confirmButton = document.querySelector('button[data-testid="confirmationSheetConfirm"]');

              await randomDelay(minThink, maxThink); // <<< ADD THINKING DELAY before confirm click >>>

              if (!confirmButton) {
                logDebug('Could not find confirmation "Unfollow" button.', 'error');
                reject(new Error('Confirmation button not found'));
                return;
              }

              // 3. Click the confirmation "Unfollow" button
              logDebug('Clicking confirmation "Unfollow" button...', 'info');
              confirmButton.click();

              // 4. Verify the unfollow by checking if the button changed back to "Follow"
              await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for UI update
              logDebug('Verifying unfollow action...', 'info');

              const followButtonNow = document.querySelector('button[data-testid$="-follow"]') || document.querySelector('button[data-testid="user-follow-button"]');
              if (followButtonNow && !document.querySelector('button[data-testid*="unfollow"]')) {
                logDebug(`Successfully unfollowed @${username} (verified)`, 'success');
                resolve(true); // Unfollow successful
              } else {
                logDebug('Unfollow verification failed (button did not change to "Follow")', 'error');
                resolve(false); // Unfollow failed verification
              }
        } catch (error) {
              logDebug(`Error during unfollow process for @${username}: ${error.message}`, 'error');
              reject(error);
            }
          } else {
             logDebug(`Searching for 'Following' button... attempt ${attempts}`, 'info');
          }
        }, 500); // Check every 500ms
      });
    }
    // --- END unfollowUser FUNCTION ---

  // --- REMOVED OLD processFollowQueue function ---

  // --- NEW State Machine Core Logic ---

  /**
   * Processes the *currently targeted* user based on agent state.
   * Assumes the agent is running and the browser is on the correct user's profile page.
   */
  async function processCurrentUser() {
      logDebug(`Entering processCurrentUser for page: ${window.location.href}`, 'info');
      let localErrorCount = 0; // Track errors for this specific user processing
      let extractedUsers = []; // Define here to ensure it's accessible
      let followedUsers = [];
      let settings = {};
      let currentState = {};
      let username = null;

      try {
          // Get current state, settings, and user lists from storage
          // <<< Make sure agentState has dailyStats initialized correctly (in background.js) >>>
          const data = await chrome.storage.local.get(['agentState', 'agentSettings', 'extractedUsers', 'followedUsers']);
          currentState = data.agentState || {};
          // <<< Ensure dailyStats and its properties exist >>>
          currentState.dailyStats = currentState.dailyStats || { date: new Date().toISOString().slice(0, 10), followCount: 0, unfollowCount: 0 };
          if (typeof currentState.dailyStats.followCount === 'undefined') currentState.dailyStats.followCount = 0;
          if (typeof currentState.dailyStats.unfollowCount === 'undefined') currentState.dailyStats.unfollowCount = 0;

          // Initialize daily stats
          const now = new Date();
          const todayStr = now.toISOString().slice(0, 10);
          const currentHourStr = now.toISOString().slice(0, 13); // YYYY-MM-DDTHH

          if (currentState.dailyStats.date !== todayStr) {
              logDebug(`Resetting daily stats for new date: ${todayStr}`, 'info');
              currentState.dailyStats = { date: todayStr, followCount: 0, unfollowCount: 0 };
          } else {
              currentState.dailyStats.followCount = currentState.dailyStats.followCount || 0;
              currentState.dailyStats.unfollowCount = currentState.dailyStats.unfollowCount || 0;
          }

          // Initialize hourly stats (simple approach: store count for current hour)
          currentState.hourlyStats = currentState.hourlyStats || {};
          if (!currentState.hourlyStats[currentHourStr]) {
              logDebug(`Initializing hourly stats for hour: ${currentHourStr}`, 'info');
              // Simple reset: Only track the *current* hour accurately. Old hours are lost.
              // For persistent hourly tracking, background script logic would be needed.
              currentState.hourlyStats = { [currentHourStr]: { followCount: 0, unfollowCount: 0 } };
          } else {
              currentState.hourlyStats[currentHourStr].followCount = currentState.hourlyStats[currentHourStr].followCount || 0;
              currentState.hourlyStats[currentHourStr].unfollowCount = currentState.hourlyStats[currentHourStr].unfollowCount || 0;
          }

          // Initialize session action count (if not already set by startAgent)
          currentState.sessionActionCount = currentState.sessionActionCount || 0;

          settings = data.agentSettings || {};
          extractedUsers = data.extractedUsers || [];
          followedUsers = data.followedUsers || [];
          logDebug('Loaded agent settings:', 'info', settings);
          logDebug('Loaded behavior settings:', 'info', {
            hourlyLimit: settings.hourlyFollowLimit,
            sessionLimit: settings.maxActionsSession,
            minThink: settings.minThinkingTime,
            maxThink: settings.maxThinkingTime
          });
          logDebug(`Loaded ${extractedUsers.length} users from queue and ${followedUsers.length} followed users`, 'info');

          // Ensure agent is still supposed to be running
          if (!currentState.isRunning || !currentState.currentUser) {
              logDebug('Agent stopped or no current user while trying to process. Aborting.', 'warning');
              // Don't automatically stop here, let the logic flow or external stop handle it
          return;
        }
        
          username = currentState.currentUser;
          logDebug(`Processing current user: @${username}`, 'info', { settings });

          // --- Start: Logic adapted from the old processFollowQueue loop ---

          // <<< Check daily follow limit (use ?. for safety) >>>
          const dailyLimit = settings.dailyFollowLimit || 50;
          logDebug(`Checking daily follow limit. Current: ${currentState.dailyStats?.followCount || 0}, Limit: ${settings.dailyFollowLimit}`, 'info');
          if ((currentState.dailyStats?.followCount || 0) >= dailyLimit) {
              logDebug(`Daily follow limit reached. Stopping agent.`, 'warning');
            updateAgentOverlay(`Daily follow limit reached (${settings.dailyFollowLimit})`);
              await stopAgent(); // Gracefully stop
              return; // Stop processing
          }

          // <<< NEW: Check hourly follow limit >>>
          const hourlyLimit = settings.hourlyFollowLimit;
          if (hourlyLimit && hourlyLimit > 0) {
            const currentHourFollows = currentState.hourlyStats[currentHourStr]?.followCount || 0;
            logDebug(`Checking hourly follow limit. Current Hour (${currentHourStr}) Follows: ${currentHourFollows}, Limit: ${hourlyLimit}`, 'info');
            if (currentHourFollows >= hourlyLimit) {
              logDebug(`Hourly follow limit reached for hour ${currentHourStr}. Stopping agent.`, 'warning');
              updateAgentOverlay(`Hourly follow limit reached (${hourlyLimit})`);
              await stopAgent();
              return;
            }
          }

          // <<< NEW: Check session action limit >>>
          const sessionLimit = settings.maxActionsSession;
          if (sessionLimit && sessionLimit > 0) {
              logDebug(`Checking session action limit. Current Session Actions: ${currentState.sessionActionCount}, Limit: ${sessionLimit}`, 'info');
              if (currentState.sessionActionCount >= sessionLimit) {
                  logDebug(`Max actions per session reached. Stopping agent.`, 'warning');
                  updateAgentOverlay(`Max actions per session reached (${sessionLimit})`);
                  await stopAgent();
                  return;
              }
          }

          // <<< Check consecutive errors >>>
          logDebug(`Checking consecutive errors. Current: ${agentStateInMemory.consecutiveErrors}`, 'info');
          if (agentStateInMemory.consecutiveErrors >= 5) {
              logDebug(`Too many consecutive errors. Pausing agent.`, 'error');
            updateAgentOverlay('Too many errors in a row, pausing agent');
              currentState.errors = currentState.errors || []; // Initialize errors array if needed
              currentState.errors.push({
              error: 'Agent paused due to too many consecutive errors',
              time: new Date().toISOString()
            });
              await stopAgent(); // Gracefully stop
              return; // Stop processing
          }

          // Validate username
          if (!username || typeof username !== 'string' || !username.match(/^[A-Za-z0-9_]{1,15}$/)) {
              logDebug(`Invalid username found in state: ${username}. Skipping.`, 'warning');
              // Need to ensure we still call processNextUser even when skipping invalid user
              await processNextUser(username, extractedUsers, followedUsers, settings, currentState);
              return;
          }
          
          // Show status
          updateAgentOverlay(`Processing user: @${username}`);
          logDebug(`Updated overlay. Now processing user: @${username}`, 'info');

          try {
              logDebug(`Attempting to check follow status for @${username}...`, 'info');
              let followStatus = await checkFollowStatus(username);
              logDebug(`Follow status check result for @${username}:`, 'info', followStatus);
            
            if (followStatus.following) {
                  logDebug(`Already following @${username}. Checking unfollow criteria...`, 'info');

                  // --- UNFOLLOW LOGIC ---
                  let shouldUnfollow = false;
                  const userFollowRecord = followedUsers.find(u => u.username === username);

                  if (settings.enableAutoUnfollow && userFollowRecord && !userFollowRecord.unfollowedAt) {
                      const followedAtTime = new Date(userFollowRecord.followedAt).getTime();
                      const nowTime = new Date().getTime();
                      const secondsElapsed = (nowTime - followedAtTime) / 1000;

                      // <<< UPDATED: Prioritize unfollowSeconds >>>
                      const thresholdSeconds = (settings.unfollowSeconds && settings.unfollowSeconds >= 5)
                          ? settings.unfollowSeconds
                          : (settings.unfollowDays > 0 ? settings.unfollowDays * 86400 : 0);

                      logDebug(`Checking unfollow timer for @${username}: ${secondsElapsed.toFixed(1)}s elapsed vs ${thresholdSeconds}s threshold`, 'info');

                      if (thresholdSeconds > 0 && secondsElapsed >= thresholdSeconds) {
                          logDebug(`Unfollow time threshold reached for @${username}. Preparing to unfollow.`, 'warning');
                          shouldUnfollow = true;
                      }
                  }
                  // --- END UNFOLLOW LOGIC ---

                  if (shouldUnfollow) {
                      updateAgentOverlay(`Unfollowing @${username}...`);
                      try {
                          const unfollowSuccess = await unfollowUser(username);
                          if (unfollowSuccess) {
                              logDebug(`Successfully unfollowed @${username}. Updating record.`, 'success');
                              updateAgentOverlay(`Unfollowed @${username}`);
                              currentState.sessionActionCount++; // Increment session count
                              // Update record in followedUsers
                              const userIndex = followedUsers.findIndex(u => u.username === username);
                              if (userIndex !== -1) {
                                  followedUsers[userIndex].unfollowedAt = new Date().toISOString();
                                  // <<< INCREMENT UNFLLOW COUNT >>>
                                  if (currentState.dailyStats) currentState.dailyStats.unfollowCount++;
                                  // Also increment hourly unfollow count
                                  if (currentState.hourlyStats[currentHourStr]) currentState.hourlyStats[currentHourStr].unfollowCount++;
                                  await chrome.storage.local.set({ followedUsers, agentState: currentState }); // Save both
                              }
                              // Remove user from extractedUsers queue as they've been processed (unfollowed)
                              extractedUsers = extractedUsers.filter(u => u.username !== username);
                              await chrome.storage.local.set({ extractedUsers });
                              agentStateInMemory.consecutiveErrors = 0; // Reset errors on successful unfollow
                          } else {
                              logDebug(`Unfollow attempt for @${username} failed verification.`, 'error');
                              updateAgentOverlay(`Failed to unfollow @${username}`);
                              agentStateInMemory.consecutiveErrors++;
                              currentState.errors = currentState.errors || [];
                              currentState.errors.push({
                                  username: username, error: 'Unfollow verification failed', time: new Date().toISOString()
                              });
                              await chrome.storage.local.set({ agentState: currentState });
                              // NOTE: User remains in extractedUsers list to potentially be processed again
                          }
                      } catch (unfollowError) {
                          logDebug(`Error during unfollowUser call for @${username}: ${unfollowError.message}`, 'error');
                          updateAgentOverlay(`Error unfollowing @${username}`);
                          agentStateInMemory.consecutiveErrors++;
                          currentState.errors = currentState.errors || [];
                          currentState.errors.push({
                                  username: username, error: `Unfollow error: ${unfollowError.message}`, time: new Date().toISOString()
                          });
                          await chrome.storage.local.set({ agentState: currentState });
                          // NOTE: User remains in extractedUsers list
                      }
                  } else {
                      // If not unfollowing, just skip and remove from queue
                      logDebug(`Not unfollowing @${username} yet or feature disabled. Skipping.`, 'info');
                      updateAgentOverlay(`Already following @${username}, skipping`);
                      extractedUsers = extractedUsers.filter(u => u.username !== username);
                      await chrome.storage.local.set({ extractedUsers });
                      agentStateInMemory.consecutiveErrors = 0; // Reset errors on successful skip
                  }
                  // --- END "IF FOLLOWING" BLOCK ---

              } else { // User is NOT currently followed
                  logDebug(`Not following @${username}. Proceeding to follow attempt.`, 'info');
                  updateAgentOverlay(`Following user: @${username}`);
                  logDebug(`Attempting followUser for @${username}...`, 'info');

                  // Attempt to follow the user (using the function without navigation)
                  let followSuccess = await followUser(username);
                  logDebug(`followUser attempt for @${username} completed. Success: ${followSuccess}`, 'info');
              
              if (followSuccess) {
                      logDebug(`Successfully followed @${username}. Updating records.`, 'success');

                // Add user to followed users list
                       if (!followedUsers.some(followed => followed.username === username)) {
                            const userDetails = extractedUsers.find(u => u.username === username) || {};
                followedUsers.push({
                                username: username,
                                displayName: userDetails.displayName || '',
                                profileUrl: userDetails.profileUrl || `https://x.com/${username}`,
                  followedAt: new Date().toISOString(),
                  isFollowing: false, // We don't know if they follow back yet
                  unfollowedAt: null
                });
                       }
                
                // Update counters
                      currentState.followCount = (currentState.followCount || 0) + 1; // Keep total count for now?
                      currentState.sessionActionCount++; // Increment session count
                      // <<< Use ?. for safety >>>
                      if (currentState.dailyStats) currentState.dailyStats.followCount = (currentState.dailyStats.followCount || 0) + 1;
                      logDebug(`Updated follow counts. Daily: ${currentState.dailyStats?.followCount || 0}`, 'info');

                      // Save updated state and lists
                      await chrome.storage.local.set({
                          followedUsers,
                          agentState: currentState
                      });

                      // Remove user from extractedUsers queue ONLY on SUCCESS
                      extractedUsers = extractedUsers.filter(u => u.username !== username);
                      await chrome.storage.local.set({ extractedUsers });

                      updateAgentOverlay(`Successfully followed @${username}`);
                      // Reset consecutive error counter on success
                      agentStateInMemory.consecutiveErrors = 0;
                  } else {
                      logDebug(`Follow attempt for @${username} did not return success (verification failed).`, 'warning');
                      localErrorCount++;
                      agentStateInMemory.consecutiveErrors++;
                      currentState.errors = currentState.errors || [];
                      currentState.errors.push({
                          username: username,
                          error: 'Follow attempt failed verification',
                          time: new Date().toISOString()
                      });
                      await chrome.storage.local.set({ agentState: currentState }); // Save error state
                      // NOTE: User remains in extractedUsers list
                  }
              }
          } catch (error) {
              logDebug(`Error processing user @${username}:`, 'error', error.message);
              updateAgentOverlay(`Error with @${username}: ${error.message}`);

              localErrorCount++;
              agentStateInMemory.consecutiveErrors++;
              currentState.errors = currentState.errors || [];
              currentState.errors.push({
                  username: username,
              error: error.message,
              time: new Date().toISOString()
            });
              await chrome.storage.local.set({ agentState: currentState }); // Save error state
              // NOTE: User remains in extractedUsers list in case of error during processing
          }

          // --- Find next user and navigate ---
          // This is called regardless of success/failure/skip/unfollow of the current user
          await processNextUser(username, extractedUsers, followedUsers, settings, currentState);

      } catch (error) {
          logDebug('Critical error in processCurrentUser:', 'error', error);
          updateAgentOverlay(`Critical Error: ${error.message}. Stopping agent.`);
          await stopAgent(); // Gracefully stop on critical error
      }
  }

  /**
   * Finds the next user (either from queue or followed list), updates state, and navigates.
   * Called after processing the current user.
   */
  async function processNextUser(processedUsername, currentExtractedUsers, currentFollowedUsers, settings, currentState) {
      logDebug(`Entering processNextUser. Received ${currentExtractedUsers.length} extracted, ${currentFollowedUsers.length} followed.`, 'info');
      logDebug(`Finding next user after processing @${processedUsername}`, 'info');

      let nextUserTarget = null; // { username: '...', action: 'follow'/'unfollowCheck' }

      // --- Stage 1: Prioritize following users from the extraction queue ---
      if (settings.enableAutoFollow) {
          const followedUsernames = new Set(currentFollowedUsers.map(u => u.username)); // Create a Set for efficient lookup
          const usersReadyForFollow = currentExtractedUsers.filter(extractUser =>
              !followedUsernames.has(extractUser.username) // Use Set.has() for filtering
          );

          logDebug(`Stage 1: Found ${usersReadyForFollow.length} users in queue ready for follow. Daily count: ${currentState.dailyStats?.followCount || 0}, Limit: ${settings.dailyFollowLimit}`, 'info', usersReadyForFollow.slice(0, 5)); // Log first 5 candidates

          if (usersReadyForFollow.length > 0 && (currentState.dailyStats?.followCount || 0) < settings.dailyFollowLimit) {
              nextUserTarget = { username: usersReadyForFollow[0].username, action: 'follow' };
              logDebug(`Next action: Follow @${nextUserTarget.username} from queue.`, 'info');
          } else {
              if (usersReadyForFollow.length === 0) {
                  logDebug('Stage 1 Reason: Follow queue is empty.', 'info');
              } else {
                  logDebug(`Stage 1 Reason: Daily follow limit reached (${currentState.dailyStats?.followCount || 0}/${settings.dailyFollowLimit}).`, 'warning');
              }
          }
      }

      // --- Stage 2: If no users to follow, check for users to potentially unfollow ---
      if (!nextUserTarget && settings.enableAutoUnfollow) {
          logDebug('Follow queue empty or disabled. Checking followed list for potential unfollows...', 'info');

          const usersEligibleForUnfollowCheck = currentFollowedUsers
              .filter(u => !u.unfollowedAt) // Only consider users not already marked as unfollowed
              .sort((a, b) => new Date(a.followedAt) - new Date(b.followedAt)); // Check oldest first

          if (usersEligibleForUnfollowCheck.length > 0) {
               // Find the first user whose follow time could potentially meet the threshold.
               // Note: processCurrentUser does the definitive time check. This just selects a candidate.
               const nowTime = new Date().getTime();
               const thresholdSeconds = (settings.unfollowSeconds && settings.unfollowSeconds >= 5)
                          ? settings.unfollowSeconds
                          : (settings.unfollowDays > 0 ? settings.unfollowDays * 86400 : 0);

               let candidate = null;
               for (const user of usersEligibleForUnfollowCheck) {
                    const followedAtTime = new Date(user.followedAt).getTime();
                    const secondsElapsed = (nowTime - followedAtTime) / 1000;
                    // Select the first user who *might* be past the threshold or is the oldest if threshold is 0
                    if (thresholdSeconds > 0 && secondsElapsed >= (thresholdSeconds * 0.8)) { // Check if close to threshold
                         candidate = user;
                         break;
                    } else if (thresholdSeconds === 0 && !candidate) { // Fallback: just pick oldest if no threshold
                        candidate = user; // Should not happen with validation, but safety.
                    }
               }
               // If no one is close, just pick the oldest one followed
               if (!candidate && usersEligibleForUnfollowCheck.length > 0) {
                   candidate = usersEligibleForUnfollowCheck[0];
               }


               if (candidate) {
                    nextUserTarget = { username: candidate.username, action: 'unfollowCheck' };
                    logDebug(`Next action: Check unfollow status for @${nextUserTarget.username}.`, 'info');
        } else {
                    logDebug('No users found in followed list eligible for unfollow check.', 'info');
               }
          } else {
               logDebug('Followed list is empty or all users have been unfollowed.', 'info');
          }
      }

      logDebug(`Decision point: nextUserTarget = ${JSON.stringify(nextUserTarget)}`, 'info');

      // --- Stage 3: Navigate or Stop ---
      if (nextUserTarget) {
          // Found the next user to process (either follow or unfollow check)
          currentState.currentUser = nextUserTarget.username;
          logDebug(`Setting current user to @${currentState.currentUser} for action: ${nextUserTarget.action}`, 'info');

          // Calculate delay (use followInterval for both actions for simplicity now)
          const baseDelay = settings.followInterval * 1000;
          const variance = settings.timeVariance / 100;
          const randomFactor = 1 - variance + (Math.random() * variance * 2);
          const delay = Math.max(1000, Math.round(baseDelay * randomFactor)); // Ensure minimum 1s delay

          logDebug(`Waiting ${delay}ms before navigating to @${currentState.currentUser}`, 'info');
          updateAgentOverlay(`Waiting ${Math.round(delay/1000)}s...`);

          // Save state *before* the delay
          await chrome.storage.local.set({ agentState: currentState });

          // Wait and navigate
          await new Promise(resolve => setTimeout(resolve, delay));
          await randomDelay(settings.minThinkingTime || 0, settings.maxThinkingTime || 0); // <<< Use settings object for thinking time >>>

          // Check if the agent was stopped during the delay
          const latestState = await chrome.storage.local.get('agentState'); // Re-fetch state
          if (!latestState?.agentState?.isRunning) {
              logDebug('Agent stopped during navigation delay. Aborting navigation.', 'warning');
              return;
          }

          logDebug(`Navigating to @${currentState.currentUser} for ${nextUserTarget.action}`, 'info');
          updateAgentOverlay(`Navigating to @${currentState.currentUser}...`);
          window.location.href = `https://x.com/${currentState.currentUser}`;

      } else {
          // No more users to follow and no users to check for unfollow
          logDebug('No more users in queue and no users eligible for unfollow check. Stopping agent.', 'info');
          updateAgentOverlay('Agent finished processing.');
          await stopAgent(); // Use the stop function to clean up state
      }
    }

    /**
     * Start the follow agent
     */
    async function startAgent() {
    logDebug('Entering startAgent function', 'info');
    return new Promise(async (resolve, reject) => {
      try {
        // Get current running state from storage first
        let storedState = (await chrome.storage.local.get('agentState')).agentState || {};
        if (storedState.isRunning) {
          logDebug('Agent start requested, but already running (according to storage)', 'warning');
          updateAgentOverlay('Agent already running');
          resolve({ success: true, message: 'Agent already running', state: storedState });
          return;
        }

        logDebug('Starting agent process...', 'info');
        updateAgentOverlay('Starting agent...');

        // Get today's date
        const today = new Date().toISOString().slice(0, 10);

        // Initialize or reset daily stats (ensure unfollowCount is included)
        if (!storedState.dailyStats || storedState.dailyStats.date !== today) {
          logDebug(`Resetting daily stats for new date: ${today}`, 'info');
          // <<< Ensure unfollowCount is initialized >>>
          storedState.dailyStats = { date: today, followCount: 0, unfollowCount: 0 };
        } else {
             // Ensure counts exist even if date matches
             storedState.dailyStats.followCount = storedState.dailyStats.followCount || 0;
             storedState.dailyStats.unfollowCount = storedState.dailyStats.unfollowCount || 0;
        }

        // Initialize hourly stats (simple approach: store count for current hour)
        const currentHourStr = new Date().toISOString().slice(0, 13);
        storedState.hourlyStats = storedState.hourlyStats || {};
        if (!storedState.hourlyStats[currentHourStr]) {
            logDebug(`Initializing hourly stats in startAgent for hour: ${currentHourStr}`);
            // Resetting the whole object might be too aggressive if agent stops/starts mid-hour
            // Only initialize the current hour if it doesn't exist.
            storedState.hourlyStats[currentHourStr] = { followCount: 0, unfollowCount: 0 };
        }

        // Get settings and user lists
        const data = await chrome.storage.local.get(['agentSettings', 'extractedUsers', 'followedUsers']);
        const settings = data.agentSettings || {};
        let extractedUsers = data.extractedUsers || [];
        const followedUsers = data.followedUsers || [];
        logDebug('Loaded agent settings:', 'info', settings);
        logDebug('Loaded behavior settings:', 'info', {
          hourlyLimit: settings.hourlyFollowLimit,
          sessionLimit: settings.maxActionsSession,
          minThink: settings.minThinkingTime,
          maxThink: settings.maxThinkingTime
        });
        logDebug(`Loaded ${extractedUsers.length} users from queue and ${followedUsers.length} followed users`, 'info');

        // <<< Modified checks slightly for clarity >>>
        if (!settings || (!settings.enableAutoFollow && !settings.enableAutoUnfollow)) {
           logDebug('Agent cannot start: Auto-follow and Auto-unfollow are both disabled in settings.');
           updateAgentOverlay('Agent disabled in settings');
           resolve({ success: false, message: 'Auto-follow and auto-unfollow are disabled.', state: storedState });
           return;
        }

        // Filter out already followed users (no change needed here)
        const usersToProcess = extractedUsers.filter(user =>
            !followedUsers.some(followed => followed.username === user.username && !followed.unfollowedAt) // Exclude already followed *and not unfollowed*
        );

        if (settings.enableAutoFollow && usersToProcess.length === 0) {
          logDebug('Auto-follow enabled, but no users remaining in the extraction queue to process.');
          // If auto-unfollow is ALSO enabled, we might still want to start to check existing follows
          if (!settings.enableAutoUnfollow) {
             updateAgentOverlay('No users to follow in queue.');
             resolve({ success: false, message: 'No users left in the queue to follow.', state: storedState });
             return;
          } else {
              logDebug('Proceeding with agent start for potential unfollow checks.');
          }
        }


        // --- Update Agent State in Storage ---
        logDebug('Setting agent state to running', 'info');
        storedState.isRunning = true;
        storedState.lastRun = new Date().toISOString();
        storedState.errors = storedState.errors || []; // Ensure errors array exists
        agentStateInMemory.consecutiveErrors = 0; // Reset in-memory counter

        // <<< Initialize session action count for this run >>>
        storedState.sessionActionCount = 0;

        // <<< Select first user logic slightly adjusted >>>
        if (settings.enableAutoFollow && usersToProcess.length > 0) {
            storedState.currentUser = usersToProcess[0].username;
            logDebug(`Setting first user to process for follow: @${storedState.currentUser}`, 'info');
        } else {
            // If only unfollow is enabled OR follow queue is empty but unfollow is on, start without a target user.
            // The agent will need logic to pick someone from the *followed* list later.
            // For now, processCurrentUser handles the current page, processNextUser handles queue.
            // This needs refinement for a pure unfollow mode.
            storedState.currentUser = null;
            if(settings.enableAutoUnfollow) {
                logDebug('Agent started. Will check current page or wait for navigation if only unfollow is enabled or follow queue is empty.', 'info');
                 updateAgentOverlay('Agent starting (unfollow active)...');
            } else {
                 logDebug('Agent started but no users to process immediately.', 'info');
                 updateAgentOverlay('Agent starting (idle)...');
            }
        }

        await chrome.storage.local.set({ agentState: storedState });
        // Update in-memory state as well
        agentStateInMemory.isRunning = storedState.isRunning;
        agentStateInMemory.currentUser = storedState.currentUser;

        // --- Navigate logic adjusted ---
        if (storedState.currentUser) { // Only navigate if we selected a user from the queue
            logDebug(`Navigating to first user profile: @${storedState.currentUser}`, 'info');
            updateAgentOverlay(`Navigating to @${storedState.currentUser}...`);
            await new Promise(resolve => setTimeout(resolve, 100));
            window.location.href = `https://x.com/${storedState.currentUser}`;
        } else if (settings.enableAutoUnfollow) {
            // If no currentUser (e.g., only unfollow active), maybe trigger a check on the current page?
             logDebug('No user from queue to navigate to. Checking current page state...', 'info');
             // Immediately trigger checkAgentStateAndProcess to potentially process the user on the current page
             setTimeout(checkAgentStateAndProcess, 100); // Run it very soon
        }


        logDebug('startAgent function finished, resolving success', 'info');
        resolve({
          success: true, 
            message: 'Agent started successfully',
            state: storedState
        });
      } catch (error) {
        logDebug('Critical error in startAgent:', 'error', error);
        await chrome.storage.local.set({ agentState: { isRunning: false, errors: [{ error: error.message, time: new Date().toISOString() }] } });
        agentStateInMemory.isRunning = false;
        updateAgentOverlay(`Error starting agent: ${error.message}`);
        setTimeout(removeAgentOverlay, 5000);
        reject(error);
      }
    });
    }

    /**
     * Stop the follow agent
     */
    async function stopAgent() {
    return new Promise(async (resolve) => {
      try {
        logDebug('Stopping agent...');
        updateAgentOverlay('Stopping agent...');
        
        // Update state in storage
        const data = await chrome.storage.local.get('agentState');
        let currentState = data.agentState || {};
        currentState.isRunning = false;
        currentState.currentUser = null; // Clear current user on stop
        await chrome.storage.local.set({ agentState: currentState });

        // Update in-memory state
        agentStateInMemory.isRunning = false;
        agentStateInMemory.currentUser = null;
        agentStateInMemory.consecutiveErrors = 0; // Reset errors on stop
      
        updateAgentOverlay('Agent stopped');
        setTimeout(removeAgentOverlay, 2000);
      
        resolve({ success: true, message: 'Agent stopped successfully', state: currentState });
      } catch (error) {
        // ... (error handling unchanged)
        logDebug('Error stopping agent:', error);
        agentStateInMemory.isRunning = false; // Force in-memory state
        updateAgentOverlay(`Error stopping agent: ${error.message}`);
        setTimeout(removeAgentOverlay, 3000);
        resolve({ success: false, error: error.message, state: { isRunning: false } }); // Return basic stopped state
      }
    });
  }
  
  /**
   * Get the agent's current status from storage
     */
    async function getAgentStatus() {
      try {
          const data = await chrome.storage.local.get('agentState');
          // Update in-memory state for consistency, though it might be slightly stale
          if (data.agentState) {
              agentStateInMemory.isRunning = data.agentState.isRunning;
              agentStateInMemory.currentUser = data.agentState.currentUser;
          }
      return { 
        success: true, 
              state: data.agentState || { isRunning: false } // Return default if not found
      };
      } catch (error) {
          logDebug('Error getting agent status from storage:', 'error', error);
          return { success: false, error: error.message, state: agentStateInMemory }; // Fallback to in-memory
      }
    }

  // --- EXPOSE FUNCTIONS (Unchanged) ---
    window.startAgent = startAgent;
    window.stopAgent = stopAgent;
    window.getAgentStatus = getAgentStatus;
  // ... (debug functions unchanged) ...
  
  // --- PAGE LOAD TRIGGER --- 
  let checkStateRetries = 0; // Add retry counter
  const maxCheckStateRetries = 5; // Limit retries

  async function checkAgentStateAndProcess() {
    try {
        logDebug(`Page loaded, checking agent state... (Attempt ${checkStateRetries + 1})`, 'info');

        // >>> ADD Check for chrome.storage.local <<<
        if (!(chrome && chrome.storage && chrome.storage.local)) {
            logDebug('chrome.storage.local not available yet.', 'warning');
            if (checkStateRetries < maxCheckStateRetries) {
                checkStateRetries++;
                logDebug(`Retrying checkAgentStateAndProcess shortly... (${checkStateRetries}/${maxCheckStateRetries})`, 'info');
                setTimeout(checkAgentStateAndProcess, 1500 + (checkStateRetries * 500)); // Increase delay slightly each retry
            } else {
                logDebug('Max retries reached for chrome.storage.local. Aborting agent check.', 'error');
            }
            return; // Exit for now
        }

        // Reset retry counter if storage is available
        checkStateRetries = 0;

        const data = await chrome.storage.local.get('agentState'); // Now safe to call
        const currentState = data.agentState;

        // Update in-memory state from storage on load
        agentStateInMemory.isRunning = currentState?.isRunning || false;
        agentStateInMemory.currentUser = currentState?.currentUser || null;
        // Don't reset consecutive errors here, let processCurrentUser handle it

        if (currentState && currentState.isRunning && currentState.currentUser) {
            logDebug(`Agent is running. Current target user: @${currentState.currentUser}`, 'info');
            
            const pathParts = window.location.pathname.split('/');
            const currentProfileUsername = (pathParts.length > 1 && pathParts[1]) ? pathParts[1] : null;

            if (currentProfileUsername && currentProfileUsername.toLowerCase() === currentState.currentUser.toLowerCase()) {
                logDebug(`Current page matches target user @${currentState.currentUser}. Processing...`, 'info');
                // --- Call the new processing function ---
                await processCurrentUser(); 
            } else {
                logDebug(`Current page (${currentProfileUsername || window.location.pathname}) does not match target user @${currentState.currentUser}. Agent waiting.`, 'info');
                // Optional: Add logic here to navigate *back* to the target user if the URL is wrong?
                // Or maybe just let it wait for manual navigation or the next scheduled action.
            }
        } else {
            logDebug(`Agent is not running or no target user set. Current URL: ${window.location.href}`, 'info');
        }
    } catch (error) {
        checkStateRetries = 0; // Reset counter on other errors too
        logDebug('Error checking agent state on page load:', 'error', error);
    }
  }
  
  // Run the check shortly after the script initializes
  // >>> INCREASED Delay <<<
  setTimeout(checkAgentStateAndProcess, 2500); // Increased delay to 2.5 seconds

})(); // Immediately invoke to initialize
} 
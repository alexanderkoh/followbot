// Log right at the start of the script execution
console.log('Background Script: Top-level execution started.');

// Initialize when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log('X Growth Agent installed/updated');
  
  // Initialize storage with default values if needed
  chrome.storage.local.get(['extractedUsers', 'agentSettings', 'followedUsers'], (data) => {
    if (!data.extractedUsers) {
      chrome.storage.local.set({ extractedUsers: [] });
    }
    
    if (!data.followedUsers) {
      chrome.storage.local.set({ followedUsers: [] });
    }
    
    // Initialize agent settings if not present
    if (!data.agentSettings) {
      chrome.storage.local.set({
        agentSettings: {
          dailyFollowLimit: 50,
          followInterval: 60,
          unfollowDays: 3,
          timeVariance: 20,
          enableAutoFollow: true,
          enableAutoUnfollow: true,
          lastUpdated: new Date().toISOString(),
          hourlyFollowLimit: 0,
          maxActionsSession: 0,
          unfollowSeconds: 0,
          minThinkingTime: 250,
          maxThinkingTime: 1250
        }
      });
    } else {
      const currentSettings = data.agentSettings;
      let needsUpdate = false;
      const defaultSettings = {
          hourlyFollowLimit: 0,
          maxActionsSession: 0,
          unfollowSeconds: 0,
          minThinkingTime: 250,
          maxThinkingTime: 1250
      };
      for (const key in defaultSettings) {
          if (!(key in currentSettings)) {
              currentSettings[key] = defaultSettings[key];
              needsUpdate = true;
          }
      }
      if (needsUpdate) {
          console.log('Updating existing settings with new default fields...', currentSettings);
          chrome.storage.local.set({ agentSettings: currentSettings });
      }
    }
    
    // Reset agent state whenever the extension is reloaded
    chrome.storage.local.set({
      agentState: {
        isRunning: false,
        lastRun: null,
        currentUser: null,
        errors: [],
        dailyStats: {
          date: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
          followCount: 0,
          unfollowCount: 0
        }
      }
    });
  });
});

// Listen for tab updates to ensure content script is injected when on Twitter/X
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only inject when the tab has fully loaded and is a Twitter/X page
  if (changeInfo.status === 'complete' && tab.url && 
      (tab.url.includes('twitter.com') || tab.url.includes('x.com'))) {
    
    console.log('Tab updated on Twitter/X, ensuring scripts are injected:', tab.url);
    
    // Keep track of injection attempts to prevent infinite retries
    const injectWithRetry = (attempt = 0) => {
      if (attempt >= 3) {
        console.log('Maximum script injection attempts reached for tab', tabId);
        return;
      }
      
      // Try to inject our scripts
      injectScriptsSequentially(tabId)
        .then((result) => {
          if (result.success) {
            console.log('Scripts injected successfully on tab update');
          } else if (result.needsRetry) {
            console.log(`Injection needs retry (attempt ${attempt + 1}), scheduling...`);
            // Wait a bit longer before retrying, increasing with each attempt
            setTimeout(() => injectWithRetry(attempt + 1), 1000 * (attempt + 1));
          } else {
            console.log('Script injection failed but no retry needed:', result.error);
          }
        })
        .catch((error) => {
          console.error('Script injection error:', error);
          // Only retry on specific errors that might benefit from a retry
          if (error.message && (
              error.message.includes('not established') ||
              error.message.includes('cannot access') ||
              error.message.includes('not ready')
          )) {
            console.log(`Will retry injection (attempt ${attempt + 1}) after error:`, error.message);
            setTimeout(() => injectWithRetry(attempt + 1), 1000 * (attempt + 1));
          }
        });
    };
    
    // Start the injection process with retries
    injectWithRetry();
  }
});

// Helper function to inject scripts in the correct order
async function injectScriptsSequentially(tabId) {
  try {
    // First, check if the tab still exists (this prevents errors when tabs are closed)
    try {
      const tab = await chrome.tabs.get(tabId);
      if (!tab) {
        console.log('Tab no longer exists, aborting injection');
        return { success: false, error: 'Tab no longer exists' };
      }
    } catch (e) {
      console.log('Tab check error, aborting injection:', e.message);
      return { success: false, error: 'Tab check error' };
    }

    // First check if content script is already loaded by trying a simple message
    // If this fails, it means we need to inject the content script
    let contentLoaded = false;
    
    try {
      // Using a simple ping to check if content script is responsive
      await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Content script ping timed out'));
        }, 300);
        
        chrome.tabs.sendMessage(tabId, { action: 'ping' }, response => {
          clearTimeout(timeoutId);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response && response.success) {
            contentLoaded = true;
            resolve(response);
          } else {
            reject(new Error('Invalid response from content script'));
          }
        });
      });
      console.log('Content script is already loaded and responsive');
    } catch (e) {
      console.log('Content script not detected or not responsive:', e.message);
      contentLoaded = false;
    }

    // Inject content.js if needed
    if (!contentLoaded) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content.js']
        });
        console.log('Content script injected successfully');
        
        // Wait a moment for content script to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (injectionError) {
        console.error('Content script injection failed:', injectionError);
        
        // Check if we can inject a simpler script to diagnose the issue
        try {
          const diagResult = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
              return {
                url: window.location.href,
                readyState: document.readyState,
                contentType: document.contentType
              };
            }
          });
          console.log('Diagnostic script result:', diagResult);
          
          // If the page isn't fully loaded or is non-HTML, we should wait
          if (diagResult[0]?.result?.readyState !== 'complete' || 
              !diagResult[0]?.result?.contentType?.includes('html')) {
            console.log('Page not ready for content script, will retry later');
            return { success: false, needsRetry: true };
          }
        } catch (diagError) {
          console.error('Diagnostic script failed:', diagError);
          return { success: false, error: 'Cannot inject any scripts to tab' };
        }
      }
    }
    
    // Check if follow agent is already loaded
    // This approach is more reliable than sending another message
    try {
      const followAgentCheckResult = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          return {
            contentLoaded: typeof window.xGrowthAgentContentLoaded !== 'undefined',
            followAgentLoaded: typeof window.xGrowthAgentFollowAgentLoaded !== 'undefined'
          };
        }
      });
      
      const scriptStatus = followAgentCheckResult[0]?.result || {};
      console.log('Script status check:', scriptStatus);
      
      // If content script is loaded but follow agent is not, inject it
      if (scriptStatus.contentLoaded && !scriptStatus.followAgentLoaded) {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['follow-agent.js']
        });
        console.log('Follow agent script injected successfully');
      }
    } catch (checkError) {
      console.error('Script status check failed:', checkError);
      // If we can't check script status, try injecting follow-agent.js anyway
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['follow-agent.js']
        });
        console.log('Follow agent script injected as fallback');
      } catch (followAgentError) {
        console.error('Follow agent injection failed:', followAgentError);
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error in sequential script injection:', error);
    return { success: false, error: error.message };
  }
}

// Helper function to find an active Twitter/X tab
async function findActiveTwitterTab() {
  const tabs = await chrome.tabs.query({
    active: true,
    url: ["*://twitter.com/*", "*://x.com/*"]
  });
  if (tabs.length > 0) {
    // Prefer the currently active window's tab if multiple matches
    const activeWindowTabs = tabs.filter(tab => tab.active && tab.windowId === chrome.windows.WINDOW_ID_CURRENT);
    if (activeWindowTabs.length > 0) return activeWindowTabs[0];
    // Fallback to the first found tab
    return tabs[0];
  }
  return null; // No suitable tab found
}

// Helper function to send logs/results back to the popup
function sendTestLog(type, data) {
  const message = type === 'testError' ? { type, error: data } : { type, log: data };
  console.log(`[Test Flow] Sending to popup: ${type}`, data);
  chrome.runtime.sendMessage(message).catch(err => {
    // Ignore errors if the popup isn't open
    if (err.message !== "Could not establish connection. Receiving end does not exist.") {
       console.warn("Error sending message to popup:", err.message);
    }
  });
}

// --- Main Test Flow Logic ---
let isTestRunning = false; // Prevent multiple concurrent tests

async function runFollowTestFlow(username, delayMs) {
  if (isTestRunning) {
    sendTestLog('testError', 'Another test is already in progress.');
    return;
  }
  isTestRunning = true;
  sendTestLog('testLog', `Starting test for ${username}...`);

  try {
    const targetTab = await findActiveTwitterTab();
    if (!targetTab) {
      throw new Error("No active Twitter/X tab found. Please navigate to twitter.com or x.com.");
    }
    const targetTabId = targetTab.id; // Store the tab ID
    sendTestLog('testLog', `Using active tab: ${targetTabId} (${targetTab.url})`);

    // --- Navigation Step ---
    const usernameWithoutAt = username.startsWith('@') ? username.substring(1) : username;
    const profileUrl = `https://x.com/${usernameWithoutAt}`;
    sendTestLog('testLog', `Navigating tab ${targetTabId} to profile: ${profileUrl}...`);

    await chrome.tabs.update(targetTabId, { url: profileUrl });

    // --- Wait for Navigation Step ---
    sendTestLog('testLog', 'Waiting for profile page navigation to complete...');
    try {
        await new Promise((resolve, reject) => {
            const listener = (tabId, changeInfo, tab) => {
                // Wait for the correct tab to finish loading the target profile URL
                if (tabId === targetTabId && changeInfo.status === 'complete' && tab.url && tab.url.startsWith(profileUrl)) {
                    chrome.tabs.onUpdated.removeListener(listener); // Clean up listener
                    console.log(`Tab ${targetTabId} finished loading URL: ${profileUrl}`);
                    resolve();
                }
            };
            chrome.tabs.onUpdated.addListener(listener);
            // Add a timeout in case navigation hangs
            setTimeout(() => {
                chrome.tabs.onUpdated.removeListener(listener); // Clean up listener
                reject(new Error('Tab navigation timed out after 30 seconds'));
            }, 30000);
        });
    } catch (navError) {
        sendTestLog('testError', `Navigation failed: ${navError.message}`);
        isTestRunning = false;
        return; // Stop the test if navigation fails
    }
    sendTestLog('testLog', `Navigation to ${profileUrl} complete.`);
    // Small delay for page rendering after load complete
    await new Promise(resolve => setTimeout(resolve, 1500)); 

    // Ensure scripts are injected *after* navigation
    sendTestLog('testLog', 'Ensuring content scripts are ready on profile page...');
    const injectionResult = await injectScriptsSequentially(targetTabId);
    if (!injectionResult.success) {
        throw new Error(injectionResult.error || "Failed to inject necessary scripts into the profile page.");
    }
    sendTestLog('testLog', 'Content scripts ready on profile page.');


    // Helper to send message to content script and await response
    const sendMessageToContent = (action, data) => {
        return new Promise((resolve, reject) => {
            const timeout = 30000; // 30 second timeout for content script actions
            const timer = setTimeout(() => {
                 reject(new Error(`Action '${action}' timed out after ${timeout/1000}s`));
            }, timeout);

            chrome.tabs.sendMessage(targetTabId, { action, ...data }, response => {
                clearTimeout(timer);
                if (chrome.runtime.lastError) {
                    reject(new Error(`Content script communication error: ${chrome.runtime.lastError.message}`));
                } else if (response && response.error) {
                     reject(new Error(`Content script error (${action}): ${response.error}`));
                 } else if (action === 'checkFollowStatus' && response && typeof response.weFollowThem !== 'undefined' && typeof response.theyFollowUs !== 'undefined') {
                     // Handle the specific { weFollowThem, theyFollowUs } response for checkFollowStatus
                     resolve(response);
                 } else if (response && response.success) {
                    // Handle generic { success: true, data: ... } responses for other actions (e.g., followUser, unfollowUser)
                    resolve(response.data || {}); // Return data if provided
                 } else {
                     // If it's neither the specific status object nor a generic success object
                     reject(new Error(`Invalid or unexpected response from content script for action '${action}'. Response: ${JSON.stringify(response)}`));
                 }
            });
        });
    };

    // 1. Determine current follow status (NOW runs on the profile page)
    sendTestLog('testLog', `Checking initial follow status for ${username}...`);
    let initialStatus;
    try {
        initialStatus = await sendMessageToContent('checkFollowStatus', { username });
         sendTestLog('testLog', `Initial status for ${username}: WeFollow=${initialStatus.weFollowThem}, TheyFollow=${initialStatus.theyFollowUs}`);
    } catch (err) {
         // If status check fails (e.g., user not found), log and end.
         throw new Error(`Failed to get initial status for ${username}: ${err.message}`);
    }

    // --- NEW Logic Branching ---
    if (initialStatus.weFollowThem) {
        // Scenario 1: We are already following the user.
        if (initialStatus.theyFollowUs) {
            // Sub-Scenario 1a: They follow us back.
            sendTestLog('testResult', `Already following ${username}, and they follow back. Test concludes.`);
        } else {
            // Sub-Scenario 1b: They do NOT follow us back.
            sendTestLog('testLog', `Already following ${username}, but they DO NOT follow back. Attempting unfollow...`);
            try {
                await sendMessageToContent('unfollowUser', { username });
                sendTestLog('testResult', `Unfollowed ${username} successfully (as they didn't follow back).`);
            } catch (unfollowErr) {
                sendTestLog('testError', `Failed to unfollow ${username} (who didn't follow back): ${unfollowErr.message}`);
            }
        }
        // Test ends after handling existing follow status
        isTestRunning = false;
        return;

    } else {
        // Scenario 2: We are NOT following the user.
        if (initialStatus.theyFollowUs) {
             // Sub-Scenario 2a: They follow us, but we don't follow them.
             // This case wasn't explicitly handled before, but the test could potentially just follow them.
             // For simplicity, let's treat this like the main case: follow, wait, check, unfollow if needed.
            sendTestLog('testLog', `${username} already follows you, but you are not following them. Proceeding with follow-wait-check.`);
        }
        
        // Sub-Scenario 2b: Neither follows the other (or 2a leads here).
        // Execute Follow -> Wait -> Check -> Unfollow logic.
        try {
            sendTestLog('testLog', `Attempting to follow ${username}...`);
            await sendMessageToContent('followUser', { username });
            sendTestLog('testLog', `Successfully initiated follow for ${username}. Waiting for ${delayMs / 1000}s...`);
        } catch (followErr) {
            throw new Error(`Failed to follow ${username}: ${followErr.message}`); // Propagate error
        }

        // Wait for the user-defined delay
        await new Promise(resolve => setTimeout(resolve, delayMs));
        sendTestLog('testLog', `Wait finished. Checking if ${username} followed back...`);

        // Check if the user followed back
        let finalStatus;
        try {
            finalStatus = await sendMessageToContent('checkFollowStatus', { username });
            sendTestLog('testLog', `Follow-back status for ${username}: TheyFollow=${finalStatus.theyFollowUs}`);
        } catch (err) {
            sendTestLog('testError', `Failed to check follow-back status for ${username}: ${err.message}. Cannot determine outcome.`);
            isTestRunning = false;
            return; // End test here due to inability to verify
        }

        // Handle result: Unfollow if no follow-back
        if (finalStatus.theyFollowUs) {
            sendTestLog('testResult', `${username} followed back successfully! Test complete.`);
        } else {
            sendTestLog('testLog', `${username} did not follow back. Attempting to unfollow...`);
            try {
                await sendMessageToContent('unfollowUser', { username });
                sendTestLog('testResult', `User ${username} did not follow back. Unfollowed successfully.`);
            } catch (unfollowErr) {
                sendTestLog('testError', `User ${username} did not follow back. Failed to unfollow afterwards: ${unfollowErr.message}`);
            }
        }
    }
    // --- END NEW Logic Branching ---

  } catch (error) {
    console.error("Error during test flow:", error);
    sendTestLog('testError', `Test failed: ${error.message}`);
  } finally {
    isTestRunning = false;
    sendTestLog('testLog', 'Test sequence finished.');
     // Send a final completion signal if needed by popup logic
     chrome.runtime.sendMessage({ type: 'testComplete' }).catch(() => {});
  }
}

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Log immediately upon entering the listener
  console.log('Background onMessage: Listener entered. Message:', message, 'Sender:', sender);

  // Use a switch statement for better organization
  switch (message.action) {
    case 'injectContentScript':
      const tabId = message.tabId;
      if (!tabId) {
        sendResponse({ success: false, error: 'No tab ID provided' });
        return true; // Keep channel open for async response
      }
      injectScriptsSequentially(tabId)
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true; // Indicate async response

    case 'extractUsernames':
      if (sender.tab && sender.tab.id) {
          chrome.tabs.sendMessage(sender.tab.id, message, (response) => {
              if (chrome.runtime.lastError) {
                  console.error("Error sending 'extractUsernames' to content script:", chrome.runtime.lastError.message);
                  sendResponse({ success: false, error: chrome.runtime.lastError.message });
              } else {
                  sendResponse(response);
              }
          });
          return true; // Indicate async response
      } else {
          sendResponse({ success: false, error: 'Sender tab information missing.' });
          return false;
      }

    case 'getAgentStatus':
      Promise.all([
          chrome.storage.local.get('agentState'),
          chrome.storage.local.get('agentSettings')
      ]).then(([stateData, settingsData]) => {
          sendResponse({
              success: true,
              status: stateData.agentState || {},
              settings: settingsData.agentSettings || {}
          });
      }).catch(error => {
          console.error("Error getting agent status:", error);
          sendResponse({ success: false, error: error.message });
      });
      return true; // Indicate async response

    case 'startAgent':
      console.log("Received startAgent message");
      // Placeholder: Implement actual agent starting logic here
      // This would involve setting agentState.isRunning to true,
      // potentially resetting daily counts if needed, and starting the follow/unfollow loop (e.g., using alarms).
      chrome.storage.local.set({ agentState: { isRunning: true /* ... other state fields */ } }, () => {
           console.log("Agent state set to running (basic)");
           // TODO: Start the actual agent processing loop/alarm
           sendResponse({ success: true, message: 'Agent started (basic implementation).' });
      });
      // For now, just acknowledge. Need full agent logic implementation.
      // sendResponse({ success: true, message: 'Agent starting...' });
       return true; // Indicate async response

    case 'stopAgent':
      console.log("Received stopAgent message");
      // Placeholder: Implement actual agent stopping logic here
      // This would involve setting agentState.isRunning to false,
      // clearing any pending actions/timeouts/alarms related to the agent loop.
       chrome.storage.local.set({ agentState: { isRunning: false /* ... other state fields */ } }, () => {
           console.log("Agent state set to stopped (basic)");
           // TODO: Stop the actual agent processing loop/alarm
           sendResponse({ success: true, message: 'Agent stopped (basic implementation).' });
       });
      // sendResponse({ success: true, message: 'Agent stopping...' });
      return true; // Indicate async response

    // <<< NEW: Handle Test Flow Request >>>
    case 'runFollowTest':
        console.log("Received runFollowTest message with:", message);
        const { username, delayMs } = message;
        if (!username || typeof delayMs !== 'number') {
            sendResponse({ status: 'error', message: 'Invalid parameters for test.' });
            return false; // No async response needed
        }
        // Run the flow asynchronously, don't block the listener
        runFollowTestFlow(username, delayMs).catch(err => {
             console.error("Unhandled error running test flow:", err);
             // Send an error log if the flow itself throws unhandled exception
             sendTestLog('testError', `Unexpected error in test flow: ${err.message}`);
        });
        // Acknowledge receipt of the request immediately
        sendResponse({ status: 'received', message: 'Test command received by background.' });
        return false; // Indicate sync response (acknowledgement only)

    // <<< NEW: Handle requests from Content Script for follow actions (if needed) >>>
    // Example: If content script needs background to store data after a follow
    case 'recordFollowAction': // Example action name
        console.log("Background received recordFollowAction:", message.data);
        // TODO: Add logic to update storage (e.g., followedUsers list)
        // Example: updateFollowedUsers(message.data.username, /* success status */);
        sendResponse({ success: true }); // Acknowledge
        return false;

    case 'recordUnfollowAction': // Example action name
         console.log("Background received recordUnfollowAction:", message.data);
         // TODO: Add logic to update storage (e.g., followedUsers list)
         // Example: updateFollowedUsers(message.data.username, /* success status, mark as unfollowed */);
         sendResponse({ success: true }); // Acknowledge
         return false;

    // <<< NEW: Content script ping handler >>>
    case 'ping':
        console.log("Background received ping from content script");
        sendResponse({ success: true, response: 'pong' });
        return false; // Synchronous response

    default:
      console.log('Unknown message action received:', message.action);
      // Optionally send a response for unhandled actions
      // sendResponse({ success: false, error: 'Unknown action' });
      break; // Explicitly break
  }

  // Default return value if no async response is indicated
  // Important: If any case returns true, this line is not reached for that case.
   console.log(`Finished processing action '${message.action}' synchronously or did not handle.`);
  return false;
});

console.log('Background Script: Event listeners registered and script initialized.'); 
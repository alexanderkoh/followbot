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
          enableAutoFollow: false,
          enableAutoUnfollow: false,
          lastUpdated: new Date().toISOString()
        }
      });
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

// Listen for messages from popup or content scripts
// Original Listener Code (Restored)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Log immediately upon entering the listener
  console.log('Background onMessage: Listener entered. Message:', message, 'Sender:', sender);
  
  console.log('Background received message:', message);
  
  if (message.action === 'injectContentScript') {
    const tabId = message.tabId;
    if (!tabId) {
      sendResponse({ success: false, error: 'No tab ID provided' });
      return true;
    }
    
    // Use the helper function for sequential injection
    injectScriptsSequentially(tabId)
      .then((result) => {
        if (result.success) {
          console.log('Scripts injected successfully via message request');
          sendResponse({ success: true });
        } else {
          console.warn('Script injection returned unsuccessful result:', result);
          sendResponse({ success: false, error: result.error || 'Script injection failed' });
        }
      })
      .catch((error) => {
        console.error('Error injecting scripts via message request:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Indicates we'll respond asynchronously
  }
  
  // Forward messages to content script if needed
  if (message.action === 'startFollowAgent' || 
      message.action === 'stopFollowAgent' || 
      message.action === 'getAgentStatus') {
    
    // Log that we received the message
    console.log(`Background: Received ${message.action} message from sender:`, sender);
    
    // --- REVERTING SIMPLIFICATION - Using original logic with logs --- 
    // Get active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        sendResponse({ success: false, error: 'No active tab found' });
        return;
      }
      
      const tab = tabs[0];
      
      // Check if the tab has a valid URL (not chrome:// or other restricted protocols)
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
        sendResponse({ 
          success: false, 
          error: 'Cannot access extension functions on browser system pages. Please navigate to Twitter/X first.' 
        });
        return;
      }
      
      // Check if tab is on Twitter/X
      if (!tab.url.includes('twitter.com') && !tab.url.includes('x.com')) {
        sendResponse({
          success: false,
          error: 'This extension only works on Twitter/X. Please navigate to Twitter/X first.'
        });
        return;
      }
      
      // Log before forwarding the message
      console.log(`Background: Forwarding ${message.action} message via attemptMessageSend to tab`, tab.id); // Updated log text
      
      // Multiple attempts to ensure scripts are properly loaded
      const attemptMessageSend = (attempt = 0) => {
        console.log(`Background (attempt ${attempt}): Inside attemptMessageSend for action: ${message.action}`);
        if (attempt >= 3) {
          sendResponse({
            success: false,
            error: 'Failed to communicate with the page after multiple attempts. Try refreshing the page.'
          });
          return;
        }
        
        console.log(`Background (attempt ${attempt}): Calling injectScriptsSequentially...`);
        // First ensure scripts are injected using our helper function
        injectScriptsSequentially(tab.id)
          .then((result) => {
            console.log(`Background (attempt ${attempt}): injectScriptsSequentially result:`, result);
            if (!result.success) {
              if (result.needsRetry && attempt < 2) {
                console.log(`Script injection needs retry (attempt ${attempt + 1})`);
              }
            }
            
            console.log(`Background (attempt ${attempt}): Waiting briefly after script injection...`);
            // Give a bit more time for scripts to fully initialize
            return new Promise(resolve => setTimeout(resolve, 800));
          })
          .then(() => {
            console.log(`Background (attempt ${attempt}): Preparing to forward message to content script...`);
            // Forward message to content script with proper error handling
            return new Promise((resolve, reject) => {
              const timeoutId = setTimeout(() => {
                reject(new Error('Message sending timed out'));
              }, 3000);
              
              chrome.tabs.sendMessage(tab.id, message, (response) => {
                clearTimeout(timeoutId);
                
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve(response);
                }
              });
            });
          })
          .then(response => {
            console.log(`Background (attempt ${attempt}): Received response from content script:`, response);
            sendResponse(response);
          })
          .catch(error => {
            console.error(`Background (attempt ${attempt}): Error during message handling:`, error.message);
            console.error(`Background (attempt ${attempt}): Error stack:`, error.stack);
            
            // Retry logic for specific errors
            if (attempt < 2 && error.message && (
                error.message.includes('receiving end does not exist') ||
                error.message.includes('connection') ||
                error.message.includes('timeout')
            )) {
              console.log(`Will retry message sending (attempt ${attempt + 1})`);
              setTimeout(() => attemptMessageSend(attempt + 1), 1000 * (attempt + 1));
            } else {
              sendResponse({ 
                success: false, 
                error: 'Error communicating with Twitter/X page. Try refreshing the page and try again.'
              });
            }
          });
      };
      
      // Start with first attempt
      attemptMessageSend();
    });
    
    // IMPORTANT: Because the chrome.tabs.query is asynchronous,
    // the listener function finishes executing HERE before the query callback runs.
    // To keep the message channel open for the asynchronous sendResponse,
    // the listener MUST return true.
    return true; // <<<<< THIS IS CORRECTLY PLACED
    // --- END REVERT --- 
  }
  
  // If the message wasn't handled by the above 'if' blocks, return false.
  return false; // Correct for synchronous messages or unhandled ones
}); 
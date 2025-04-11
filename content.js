// Prevent duplicate execution
if (window.xGrowthAgentContentLoaded) {
  console.log('X Growth Agent content script already loaded, preventing duplicate execution');
} else {
  // Mark as loaded
  window.xGrowthAgentContentLoaded = true;

  // Set a clear timestamp for debugging purposes
  window.xGrowthAgentLoadTime = new Date().toISOString();
  
  // Create a heartbeat function to help with detecting if the script is alive
  window.xGrowthAgentHeartbeat = function() {
    return {
      status: 'alive', 
      loadTime: window.xGrowthAgentLoadTime,
      currentTime: new Date().toISOString()
    };
  };

  console.log('X Growth Agent content script loaded on', window.location.href, 'at', window.xGrowthAgentLoadTime);

  // Check for required permissions up front
  function checkPermissions() {
    // Try to access chrome.storage as a permissions test
    if (typeof chrome !== 'undefined' && chrome.storage) {
      // Test if we can actually use it
      try {
        chrome.storage.local.get('test', function(result) {
          console.log('Storage permission confirmed, extension has necessary access');
        });
        return true;
      } catch (error) {
        console.error('Storage permission test failed:', error);
        return false;
      }
    } else {
      console.error('Chrome storage API not available, extension may not have proper permissions');
      return false;
    }
  }

  // Run permission check
  const hasPermissions = checkPermissions();
  if (!hasPermissions) {
    console.error('X Growth Agent content script loaded but missing critical permissions');
  }

  // Global variables
  let isExtracting = false;
  let extractedCount = 0;
  let statusOverlay = null;
  let followAgentInitialized = false;
  let isFollowing = false;
  let currentFollowIndex = 0;

  // Set a global flag to indicate the content script is loaded
  window.xGrowthAgentLoaded = true;

  // Log that the content script has been loaded
  console.log('X Growth Agent content script loaded on', window.location.href);

  // Check if follow agent is loaded and initialize if needed
  function checkFollowAgentStatus() {
    console.log('Checking follow agent status...');
    
    return new Promise((resolve, reject) => {
      // First check if it's already initialized
      if (window.followAgentInitialized === true) {
        console.log('Follow agent is fully initialized');
        followAgentInitialized = true;
        return resolve(true);
      }
      
      // Next check if it's at least loaded
      if (typeof window.xGrowthAgentFollowAgentLoaded !== 'undefined') {
        console.log('Follow agent is loaded but not fully initialized yet');
        
        // Wait a bit longer for full initialization
        const checkInterval = setInterval(() => {
          if (window.followAgentInitialized === true) {
            clearInterval(checkInterval);
            clearTimeout(timeout);
            console.log('Follow agent is now fully initialized');
            followAgentInitialized = true;
            resolve(true);
          }
        }, 100);
        
        // Set a timeout to prevent infinite waiting
        const timeout = setTimeout(() => {
          clearInterval(checkInterval);
          console.log('Follow agent loaded but initialization timed out');
          // Even if initialization didn't complete, we can try to continue if functions are available
          if (window.followAgentFunctionsAvailable === true || 
              (typeof window.startAgent === 'function' && 
               typeof window.stopAgent === 'function' && 
               typeof window.getAgentStatus === 'function')) {
            console.log('Functions are available, continuing anyway');
            followAgentInitialized = true;
            resolve(true);
          } else {
            reject(new Error('Follow agent initialization timed out'));
          }
        }, 5000);
        
        return;
      }
      
      console.log('Follow agent not loaded, injecting script...');
      
      try {
        // Before injecting, check if any global variables would clash
        if (window.document.querySelector('script[src*="follow-agent.js"]')) {
          console.log('Follow agent script already in DOM, not re-injecting');
          // Wait a bit more to see if it initializes
          setTimeout(() => {
            if (typeof window.xGrowthAgentFollowAgentLoaded !== 'undefined') {
              console.log('Follow agent loaded from existing script tag');
              followAgentInitialized = true;
              resolve(true);
            } else {
              console.error('Follow agent script exists but didn\'t initialize');
              // Try to remove the stale script tag and inject a fresh one
              const staleScript = window.document.querySelector('script[src*="follow-agent.js"]');
              if (staleScript) {
                staleScript.remove();
                console.log('Removed stale script tag, will retry injection');
                // Recursively call this function to retry
                checkFollowAgentStatus().then(resolve).catch(reject);
                return;
              } else {
                reject(new Error('Follow agent script exists but did not initialize properly'));
              }
            }
          }, 1000);
          return;
        }
        
        // Inject the follow agent script
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('follow-agent.js');
        
        script.onload = function() {
          console.log('Follow agent script loaded, waiting for initialization...');
          
          // Wait for initialization to complete
          const checkInterval = setInterval(() => {
            if (window.followAgentInitialized === true) {
              clearInterval(checkInterval);
              clearTimeout(timeout);
              console.log('Follow agent initialized successfully');
              followAgentInitialized = true;
              resolve(true);
            } else if (window.followAgentFunctionsAvailable === true || 
                       (typeof window.startAgent === 'function' && 
                        typeof window.stopAgent === 'function' && 
                        typeof window.getAgentStatus === 'function')) {
              // If functions are available but init isn't complete, we can still use it
              console.log('Follow agent functions available');
              followAgentInitialized = true;
              resolve(true);
            }
          }, 100);
          
          // Set a timeout to prevent infinite waiting
          const timeout = setTimeout(() => {
            clearInterval(checkInterval);
            
            // Even if initialization didn't complete, we can try to continue if the basic flag is set
            if (typeof window.xGrowthAgentFollowAgentLoaded !== 'undefined') {
              console.log('Follow agent loaded but not fully initialized, continuing anyway');
              followAgentInitialized = true;
              resolve(true);
            } else {
              console.error('Follow agent failed to initialize properly');
              reject(new Error('Failed to initialize follow agent after script load'));
            }
          }, 5000);
        };
        
        script.onerror = function(error) {
          console.error('Error loading follow agent script:', error);
          reject(new Error('Failed to load follow agent script'));
        };
        
        (document.head || document.documentElement).appendChild(script);
      } catch (error) {
        console.error('Error injecting follow agent script:', error);
        reject(error);
      }
    });
  }

  // Initialize follow agent on content script load
  checkFollowAgentStatus().catch(error => {
    console.error('Initial follow agent check failed:', error);
    // We'll try again when it's needed
  });

  // Listen for messages from the extension
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Message received in content.js:', message);
    
    // Quick ping to verify content script is active
    if (message.action === 'ping') {
      sendResponse({ success: true });
      return true;
    }
    
    // Check if follow agent is loaded
    if (message.action === 'checkAgentLoaded') {
      console.log('Checking if agent is loaded...');
      sendResponse({
        success: true,
        agentLoaded: typeof window.followAgentFunctionsAvailable !== 'undefined'
      });
      return true;
    }
    
    // Handle debug UI display via popup button
    if (message.action === 'showDebugUI') {
      console.log('Showing debug UI...');
      
      try {
        // First check if follow agent is initialized
        if (typeof window.followAgentFunctionsAvailable !== 'undefined') {
          console.log('Follow agent is fully initialized');
          
          // Create the agent overlay if needed
          if (typeof window.createAgentOverlay === 'function') {
            window.createAgentOverlay('Debug mode activated - New button click testing available!');
          }
          
          // Initialize the debug logger UI
          if (typeof window.initDebugLogger === 'function') {
            window.initDebugLogger();
            console.log('Debug logger initialized');
          }
          
          // Make debug log visible
          if (typeof window.toggleDebugVisibility === 'function') {
            window.toggleDebugVisibility(true);
            console.log('Debug log visibility enabled');
          }
          
          // Log instructions for using follow button test
          console.log('%cFind & Click Follow Buttons:', 'color: #ff4500; font-weight: bold; font-size: 14px');
          console.log('1. Navigate to a profile page (twitter.com/username)');
          console.log('2. Look for the "Test Follow Button" button in the debug panel');
          console.log('3. Click on a "Click Button #X" option to test clicking that button');
          
          sendResponse({ success: true });
          return true;
        }
        
        // Fallback to manual debug UI
        console.log('Using fallback manual debug UI');
        window.initDebugUI();
        sendResponse({ success: true });
        return true;
      } catch (error) {
        console.error('Error showing debug UI:', error);
        sendResponse({ success: false, error: error.message });
        return true;
      }
    }
    
    if (message.action === 'extractUsernames') {
      // Extract any options passed from the popup
      const options = message.options || {};
      const maxScrolls = options.maxScrolls || 50; // Default to 50 if not specified
      
      extractUsernames(maxScrolls)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Indicates we'll respond asynchronously
    }
    
    // Handle agent loaded check
    if (message.action === 'checkAgentLoaded') {
      console.log('Checking if agent is loaded...');
      const agentLoaded = 
        typeof window.xGrowthAgentFollowAgentLoaded !== 'undefined' || 
        typeof window.followAgentInitialized !== 'undefined' ||
        typeof window.followAgentFunctionsAvailable !== 'undefined';
      
      sendResponse({ 
        success: true, 
        agentLoaded: agentLoaded,
        details: {
          xGrowthAgentFollowAgentLoaded: typeof window.xGrowthAgentFollowAgentLoaded !== 'undefined',
          followAgentInitialized: typeof window.followAgentInitialized !== 'undefined',
          followAgentFunctionsAvailable: typeof window.followAgentFunctionsAvailable !== 'undefined'
        }
      });
      return true;
    }
    
    // Debug action - detailed diagnostics
    if (message.action === 'debug') {
      try {
        console.log('Running debug extraction...');
        debugExtraction()
          .then(debugInfo => {
            const result = {
              success: true,
              debugInfo: debugInfo
            };
            sendResponse(result);
            
            // Add instruction to use debug UI
            if (typeof window.initDebugUI === 'function') {
              console.log('%cUse window.initDebugUI() to see visual debug UI', 'font-weight: bold; color: #1DA1F2; font-size: 14px');
              console.log('%cUse window.testFindFollowButton() to highlight and test follow buttons', 'font-weight: bold; color: #1DA1F2; font-size: 14px');
              console.log('%cThe debug UI now includes direct button click testing!', 'font-weight: bold; color: #ff4500; font-size: 14px');
            }
          })
          .catch(error => {
            console.error('Debug extraction error:', error);
            sendResponse({
              success: false,
              error: error.message
            });
          });
        return true;
      } catch (error) {
        console.error('Error starting debug:', error);
        sendResponse({
          success: false,
          error: error.message
        });
        return true;
      }
    }
    
    // Follow agent related messages
    if (message.action === 'startFollowAgent' || 
        message.action === 'stopFollowAgent' || 
        message.action === 'getAgentStatus') {
      
      // Log immediately upon receiving the message
      console.log(`Content: Received ${message.action} message from background`, sender);
        
      // Make sure follow agent is loaded
      checkFollowAgentStatus()
        .then(() => {
          console.log('Follow agent initialized, handling message:', message.action);
          
          // For startFollowAgent, try to call the function directly
          if (message.action === 'startFollowAgent') {
            // Try direct function call if it's available
            if (typeof window.startAgent === 'function') {
              console.log('Directly calling window.startAgent()');
              
              // Show a temporary status as we're starting
              createStatusOverlay('Starting follow agent...');
              
              window.startAgent()
                .then(result => {
                  console.log('startAgent result:', result);
                  // Keep the overlay - the agent will manage it now
                  sendResponse(result);
                })
                .catch(error => {
                  console.error('Error calling startAgent:', error);
                  updateStatusOverlay('Error starting agent: ' + (error.message || 'Unknown error'));
                  
                  // Auto-hide overlay after 5 seconds
                  setTimeout(removeStatusOverlay, 5000);
                  
                  sendResponse({ 
                    success: false, 
                    error: error.message || 'Error starting agent' 
                  });
                });
            } else {
              // Fall back to message passing
              console.error('Direct function call not available - window.startAgent is missing');
              updateStatusOverlay('Error: Agent functions not loaded properly. Please reload the page.');
              
              // Auto-hide overlay after 5 seconds
              setTimeout(removeStatusOverlay, 5000);
              
              sendResponse({ 
                success: false, 
                error: 'Agent functions not initialized properly. Please reload the page.' 
              });
            }
          } else if (message.action === 'stopFollowAgent' && typeof window.stopAgent === 'function') {
            // Try direct function call
            window.stopAgent()
              .then(result => sendResponse(result))
              .catch(error => sendResponse({ 
                success: false, 
                error: error.message || 'Error stopping agent' 
              }));
          } else if (message.action === 'getAgentStatus' && typeof window.getAgentStatus === 'function') {
            // Try direct function call
            window.getAgentStatus()
              .then(result => sendResponse(result))
              .catch(error => sendResponse({ 
                success: false, 
                error: error.message || 'Error getting agent status' 
              }));
          } else {
            // Fall back to message passing for other actions
            chrome.runtime.sendMessage(message)
              .then(response => sendResponse(response))
              .catch(error => sendResponse({ 
                success: false, 
                error: `Failed to execute ${message.action}: ${error.message}` 
              }));
          }
        })
        .catch(error => {
          console.error('Error initializing follow agent:', error);
          createStatusOverlay(`Failed to initialize follow agent: ${error.message}. Please reload the page and try again.`);
          
          sendResponse({ 
            success: false, 
            error: 'Failed to initialize follow agent: ' + error.message
          });
          
          // Auto-hide overlay after 5 seconds
          setTimeout(removeStatusOverlay, 5000);
        });
      
      // Because we use both direct function calls and message forwarding,
      // we return true to indicate we might respond asynchronously
      return true;
    }
    
    return false;
  });

  /**
   * Creates a status overlay on the page to show extraction progress
   */
  function createStatusOverlay(message) {
    // Remove existing overlay if any
    if (statusOverlay) {
      statusOverlay.remove();
    }
    
    // Create new overlay
    statusOverlay = document.createElement('div');
    statusOverlay.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background-color: rgba(29, 161, 242, 0.9);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;
    statusOverlay.textContent = message;
    document.body.appendChild(statusOverlay);
    
    return statusOverlay;
  }

  /**
   * Updates the status overlay with a new message
   */
  function updateStatusOverlay(message) {
    if (statusOverlay) {
      statusOverlay.textContent = message;
    } else {
      createStatusOverlay(message);
    }
  }

  /**
   * Removes the status overlay
   */
  function removeStatusOverlay() {
    if (statusOverlay) {
      statusOverlay.remove();
      statusOverlay = null;
    }
  }

  /**
   * Auto-scrolls the page or a specific element to load more users
   */
  async function autoScrollPage(maxScrolls = 50, scrollTargetElement = null) {
    return new Promise((resolve) => {
      let scrollCount = 0;
      const target = scrollTargetElement || document.body;
      const targetWindow = scrollTargetElement ? scrollTargetElement : window;
      let lastHeight = target.scrollHeight;
      let noChangeCount = 0;
      let totalLoadedElements = 0;
      let previousLoadedElements = 0;
      
      // Function to count visible user cells within the target context
      const countUserElements = () => {
        const context = scrollTargetElement || document;
        const selectors = [
          '[data-testid="UserCell"]',
          '[data-testid="cellInnerDiv"]',
          'div[aria-label][role="button"]',
          'div[role="button"] a[role="link"][href*="/"]',
          'section[role="region"] div[role="button"]'
        ];

        for (const selector of selectors) {
          const elements = context.querySelectorAll(selector);
          if (elements.length > 0) {
            return elements.length;
          }
        }

        const mainContent = context.querySelector('main[role="main"]') || context;
        const possibleUsers = mainContent.querySelectorAll('div[role="button"], a[role="link"][href*="/"]');
        const filteredUsers = Array.from(possibleUsers).filter(el => {
          const hasImage = el.querySelector('img');
          const hasText = el.textContent && el.textContent.trim() !== '';
          return hasImage && hasText;
        });

        return filteredUsers.length;
      };
      
      // Create a more visual progress indicator
      const progressIndicator = document.createElement('div');
      progressIndicator.style.cssText = `
        position: fixed;
        bottom: 70px;
        right: 20px;
        background-color: rgba(29, 161, 242, 0.9);
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 14px;
        font-weight: 500;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      `;
      document.body.appendChild(progressIndicator);
      
      // More effective scroll function with smaller, more frequent scrolls
      const scrollInterval = setInterval(() => {
        // Get current count of loaded elements
        totalLoadedElements = countUserElements();
        
        // Calculate how many new elements loaded since last scroll
        const newElementsLoaded = totalLoadedElements - previousLoadedElements;
        previousLoadedElements = totalLoadedElements;
        
        // Perform scroll
        const scrollAmount = (scrollTargetElement ? scrollTargetElement.clientHeight : window.innerHeight) * 0.7;
        if (scrollTargetElement) {
            scrollTargetElement.scrollTop += scrollAmount;
        } else {
            window.scrollBy(0, scrollAmount);
        }
        scrollCount++;
        
        // Update progress indicators
        updateStatusOverlay(`Scrolling to load users... (${scrollCount}/${maxScrolls})`);
        progressIndicator.textContent = `Found ${totalLoadedElements} users (${newElementsLoaded > 0 ? '+' + newElementsLoaded : 'no new'} since last scroll)`;
        
        // Log progress for debugging
        console.log(`Scroll ${scrollCount}/${maxScrolls}: Found ${totalLoadedElements} users (${newElementsLoaded} new)`);
        
        // Check if we've reached the bottom or max scrolls
        setTimeout(() => {
          const newHeight = target.scrollHeight;
          const isAtBottom = scrollTargetElement
            ? (target.scrollTop + target.clientHeight >= target.scrollHeight - 10)
            : (window.innerHeight + window.scrollY >= document.body.scrollHeight - 10);

          if (newHeight === lastHeight || isAtBottom) {
            noChangeCount++;
            
            // If height hasn't changed for 3 consecutive checks, or max scrolls reached, or we are at the bottom
            if (noChangeCount >= 3 || scrollCount >= maxScrolls || isAtBottom) {
              console.log(`Stopping scroll: No change count ${noChangeCount}, Scroll count ${scrollCount}, At bottom ${isAtBottom}`);
              clearInterval(scrollInterval);
              progressIndicator.remove();
              resolve(totalLoadedElements);
            }
          } else {
            // Reset no change counter if height changed
            noChangeCount = 0;
            lastHeight = newHeight;
          }
        }, 800); // Shorter wait time for more responsive scrolling
      }, 1200); // Slightly faster interval for more scrolls
    });
  }

  /**
   * Find username from different possible DOM structures
   */
  function findUsername(cell) {
    // Different possible DOM structures for username elements
    const possibleSelectors = [
      // Most specific first
      'a[role="link"][href^="/"] div[dir="ltr"] span', // Username span inside the main link
      'a[role="link"][href^="/"] span:not(:has(span))', // Fallback span inside main link
      '[data-testid*="UserName"] span', // Covers User-Name and UserName
      '[data-testid="username"]',
      'a[href^="/"] span', // Any span inside a profile link
      'div[dir="ltr"] span' // General direction span
    ];

    let username = null;
    let displayName = null;
    let profileUrl = null;
    let usernameFound = false; // Flag to prevent unnecessary searching after finding @username

    // 1. Find the main profile link first to get the URL and potentially the username
    // Selector might need adjustment based on actual HTML structure
    const profileLinkElement = cell.querySelector('a[data-testid*="UserCell"] a[role="link"][href^="/"]') || cell.querySelector('a[role="link"][href^="/"]');
    if (profileLinkElement && profileLinkElement.href) {
        profileUrl = profileLinkElement.href;
        const pathParts = profileUrl.split('/');
        if (pathParts.length > 1) {
            const potentialUsername = pathParts[pathParts.length - 1].split('?')[0]; // Get last part before query
            if (potentialUsername && !['i', 'settings', 'notifications', 'messages', 'explore', 'home'].includes(potentialUsername)) {
                // Validate if it looks like a username before assigning
                if (/^[A-Za-z0-9_]{1,15}$/.test(potentialUsername)) {
                   username = potentialUsername; // Assume path is the username initially
                   console.log(`(findUsername) Found potential username from profile URL: ${username}`);
                   // Don't set usernameFound=true here, allow specific @username search to override
                } else {
                   console.log(`(findUsername) Potential username from URL (${potentialUsername}) is invalid.`);
                }
            }
        }
    }

    // 2. Try to find the specific @username element to override/confirm the URL username
    for (const selector of possibleSelectors) {
        try {
            const elements = cell.querySelectorAll(selector);
            for (const el of elements) {
                const text = el.textContent?.trim();
                if (text && text.startsWith('@')) {
                    const extractedUsername = text.slice(1);
                     // Validate the extracted username
                    if (/^[A-Za-z0-9_]{1,15}$/.test(extractedUsername)) {
                        username = extractedUsername; // Override with @ handle if found and valid
                        usernameFound = true; // Set flag now that we found specific @username
                        console.log(`(findUsername) Found specific username element via selector '${selector}': @${username}`);
                        break; // Found the @username, stop searching this selector's elements
                    }
                }
            }
            if (usernameFound) break; // Exit outer selector loop if @username found
        } catch (e) {
            console.warn(`(findUsername) Error with username selector: ${selector}`, e);
        }
    }

    // 3. Fallback: If no username found yet, try regex on the whole cell text
    if (!usernameFound) {
        const cellText = cell.textContent;
        // More specific regex to avoid matching random text with @
        const match = cellText?.match(/(?:^|\s)@([A-Za-z0-9_]{1,15})\b/);
        if (match && match[1]) {
             // Validate the matched username
             if (/^[A-Za-z0-9_]{1,15}$/.test(match[1])) {
                username = match[1];
                usernameFound = true;
                console.log(`(findUsername) Found username via fallback regex match: @${username}`);
            }
        }
    }

    // 4. Try to find the display name
    const displayNameSelectors = [
        'div[data-testid*="UserName"] > div:first-child span span:not(:has(span))', // First span in the username container
        'a[role="link"][href^="/"] span:not([dir])', // Span within link that doesn't have direction
        'div[dir="auto"] span span', // Nested span for display name
        'span[data-testid*="displayName"]', // data-testid variant
        'span[data-testid="UserCellUser-Name"] span' // Another specific variant observed
    ];
    for (const selector of displayNameSelectors) {
        try {
            const elements = cell.querySelectorAll(selector);
            for (const el of elements) {
                const text = el.textContent?.trim();
                // Ensure it's not the @username itself and has content
                if (text && !text.startsWith('@') && text !== username) {
                    displayName = text;
                    console.log(`(findUsername) Found display name via selector '${selector}': ${displayName}`);
                    break;
                }
            }
            if (displayName) break;
        } catch (e) {
             console.warn(`(findUsername) Error with display name selector: ${selector}`, e);
        }
    }

    // Fallback for display name: Find first prominent text node not matching username
    if (!displayName) {
        const allTextNodes = cell.querySelectorAll('span:not(:has(span))');
        for (const node of allTextNodes) {
            const text = node.textContent?.trim();
            if (text && !text.startsWith('@') && text.length > 1 && text !== username) {
                displayName = text;
                 console.log(`(findUsername) Found display name via fallback text node: ${displayName}`);
                break;
            }
        }
    }

    // Final Validation & Cleanup
    if (!username) {
        console.warn('(findUsername) Could not reliably determine username for cell.', {cellHTML: cell.outerHTML.substring(0,200)+'...'});
    } else {
        // Ensure profileUrl is set if username was found AND is valid
        if (!profileUrl) {
            profileUrl = `https://x.com/${username}`;
        }
    }

    // --- ENSURE OBJECT IS RETURNED --- 
    return { username, displayName, profileUrl };
  }

  /**
   * Extracts usernames from the current page
   */
  async function extractUsernames(maxScrolls = 50) {
    if (isExtracting) { 
      return { success: false, error: 'Extraction already in progress' };
    }
    isExtracting = true;
    extractedCount = 0;

    try {
      createStatusOverlay('Starting username extraction...');
      
      const url = window.location.href;
      const path = window.location.pathname;
      if (!url.includes('twitter.com') && !url.includes('x.com')) {
        throw new Error('Not on Twitter/X');
      }

      const isFollowersPage = path.includes('/followers');
      const isFollowingPage = path.includes('/following');
      const isVerifiedFollowersPage = path.includes('/verified_followers');
      const isListMembersPage = path.includes('/i/lists/') && path.endsWith('/members');
      const isCommunityMembersPage = path.includes('/i/communities/') && path.endsWith('/members');

      if (!isFollowersPage && !isFollowingPage && !isVerifiedFollowersPage && !isListMembersPage && !isCommunityMembersPage) {
        throw new Error('Not on a supported page (Followers, Following, Verified Followers, List Members, or Community Members)');
      }

      let scrollTargetElement = null;
      let searchContext = document;
      let pageType = 'Unknown'; // Track page type for logging

      if (isListMembersPage) {
        console.info('Detected List Members page, attempting modal scroll...');
        pageType = 'List Members';
        // Find the modal scroll container more reliably
        scrollTargetElement = document.querySelector('[aria-label="Timeline: List members"]');
        if (!scrollTargetElement) {
             // Fallback to older/other potential selectors for the list modal scroll area
            console.warn("Primary list modal selector not found, trying fallbacks...");
            scrollTargetElement = document.querySelector('div[aria-label*="Timeline: List members"]');
            // Add more fallbacks if needed
        }
        searchContext = scrollTargetElement || document; // Search within the modal if found
      } else if (isCommunityMembersPage) {
        console.info('Detected Community Members page, using standard page scroll...');
        pageType = 'Community Members';
        scrollTargetElement = window; // Scroll the main window
        searchContext = document;
      } else {
        console.info('Detected standard followers/following page, using standard page scroll...');
        pageType = isFollowersPage ? 'Followers' : (isFollowingPage ? 'Following' : 'Verified Followers');
        scrollTargetElement = window; // Scroll the main window
        searchContext = document;
      }

      console.info(`Starting extraction on ${pageType} page. Max scrolls: ${maxScrolls}. Scroll target:`, scrollTargetElement || 'window');

      updateStatusOverlay(`Scrolling to load users (max ${maxScrolls} scrolls)...`);
      const totalLoadedCount = await autoScrollPage(maxScrolls, scrollTargetElement === window ? null : scrollTargetElement);
      updateStatusOverlay(`Scrolling complete. Found approx ${totalLoadedCount} potential users. Processing...`);

      // Final extraction after all scrolling
      // Enhanced selector to potentially catch variations
      const userCellSelectors = [
          '[data-testid="UserCell"]',
          // Add other potential selectors if UserCell fails in some contexts
          // e.g., 'article[role="article"] div[data-testid="cellInnerDiv"]'
      ];
      let userElements = searchContext.querySelectorAll(userCellSelectors.join(', '));
      console.info(`Found ${userElements.length} potential UserCell elements after scrolling using selectors: ${userCellSelectors.join(', ')}`);
      
      // Fallback if primary selectors fail
      if (userElements.length === 0) {
          console.warn("Primary UserCell selectors failed, trying broader search within the main timeline/list area...");
          const mainArea = searchContext.querySelector('main[role="main"]') || 
                           searchContext.querySelector('[aria-label*="Timeline"]') || // Covers Followers, Lists, etc.
                           searchContext; // Fallback to the whole context
          if (mainArea) {
              userElements = mainArea.querySelectorAll('div[data-testid="cellInnerDiv"]'); // Common inner div
              console.info(`Fallback search found ${userElements.length} elements with 'cellInnerDiv'`);

              // Log sample HTML if fallback is used
              if (userElements.length > 0) {
                  console.log('Sample HTML of first few fallback elements:');
                  Array.from(userElements).slice(0, 3).forEach((el, i) => {
                      console.log(`Fallback Element ${i + 1} HTML:`, el.outerHTML.substring(0, 500) + '...');
                  });
              }
          }
      }

      // Log sample HTML if primary selector worked
      else if (userElements.length > 0) {
           console.log('Sample HTML of first few primary elements ([data-testid="UserCell"]):');
            Array.from(userElements).slice(0, 3).forEach((el, i) => {
                console.log(`Primary Element ${i + 1} HTML:`, el.outerHTML.substring(0, 500) + '...');
            });
      }

      const allExtractedUsernames = new Set(); // DEFINE THE SET HERE
      const newlyExtractedUsers = [];

      console.info(`Processing ${userElements.length} potential user cells...`);
      userElements.forEach((cell, index) => {
        const userInfo = findUsername(cell); // Use the enhanced findUsername

        // Log result of findUsername for each cell
        if (userInfo && userInfo.username) {
            console.log(`Cell ${index + 1}: Found username @${userInfo.username}`);
            if (!allExtractedUsernames.has(userInfo.username)) {
                 allExtractedUsernames.add(userInfo.username);
                 newlyExtractedUsers.push({
                    ...userInfo, // Spread the result from findUsername
                    extractedAt: new Date().toISOString()
                });
                console.log(`   -> Added @${userInfo.username} to extraction list.`);
            } else {
                 console.log(`   -> Skipped @${userInfo.username} (already extracted).`);
            }
        } else {
             console.warn(`Cell ${index + 1}: findUsername failed or returned invalid data. UserInfo:`, userInfo);
             // Log cell HTML on failure for debugging
             if (index < 5) { // Only log the first few failures
                console.log(`   -> Failing Cell HTML:`, cell.outerHTML.substring(0, 500) + '...');
            }
        }
      });

      // Remove duplicates from the users found on the current page/modal
      const uniqueUsersOnPage = Array.from(
        new Map(newlyExtractedUsers.map(user => [user.username, user])).values()
      );
      
      console.log(`Found ${uniqueUsersOnPage.length} unique users on the page/modal.`);
      
      // Get existing queue AND followed history
      const data = await chrome.storage.local.get(['extractedUsers', 'followedUsers']);
      const existingQueue = data.extractedUsers || [];
      const followedHistory = data.followedUsers || [];
      console.log(`Existing queue size: ${existingQueue.length}, Followed history size: ${followedHistory.length}`);
      
      // Create a set of usernames that have already been processed (followed or unfollowed)
      const processedUsernames = new Set(followedHistory.map(user => user.username));
      console.log(`Created set of ${processedUsernames.size} processed usernames.`);
      
      // Filter the newly extracted users: keep only those NOT in the processed set
      const newUsersToAdd = uniqueUsersOnPage.filter(user => {
          const alreadyProcessed = processedUsernames.has(user.username);
          if (alreadyProcessed) {
              console.log(`Skipping already processed user: @${user.username}`);
          }
          return !alreadyProcessed;
      });
      console.log(`Filtered down to ${newUsersToAdd.length} users not previously processed.`);
      
      // Merge the truly new users with the existing queue, avoiding duplicates within the queue
      const finalQueue = [...existingQueue];
      let addedCount = 0;
      const existingQueueUsernames = new Set(existingQueue.map(u => u.username)); // Check duplicates in queue
      
      for (const newUser of newUsersToAdd) {
        // Add only if not already present in the *current* queue either
        if (!existingQueueUsernames.has(newUser.username)) {
          finalQueue.push(newUser);
          addedCount++;
        } else {
           console.log(`Skipping user @${newUser.username} as they are already in the queue.`);
        }
      }
      console.log(`Added ${addedCount} new users to the queue. Final queue size: ${finalQueue.length}`);
      
      // Save the updated queue back to storage
      await chrome.storage.local.set({ extractedUsers: finalQueue });
      
      // Update status based on how many were actually added to the queue
      updateStatusOverlay(`Extracted ${uniqueUsersOnPage.length} unique users. Added ${addedCount} new users to queue.`);
      setTimeout(removeStatusOverlay, 3000);
      
      isExtracting = false;
      return {
        success: true,
        usernames: newUsersToAdd, // Return the list of users considered new (before queue duplicate check)
        addedToQueue: addedCount, // Explicitly state how many were added
        totalInQueue: finalQueue.length, // Return the new total queue size
        pageType: pageType
      };

    } catch (error) {
      console.error('Error extracting usernames:', error);
      updateStatusOverlay(`Error: ${error.message}`);
      setTimeout(removeStatusOverlay, 5000);
      isExtracting = false;
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Debug function to help troubleshoot extraction issues
   */
  async function debugExtraction() {
    try {
      // Visual indicator that debug is running
      const debugOverlay = document.createElement('div');
      debugOverlay.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background-color: rgba(255, 153, 0, 0.9);
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 14px;
        font-weight: 500;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      `;
      debugOverlay.textContent = 'Running debug analysis...';
      document.body.appendChild(debugOverlay);
      
      const debugInfo = {
        url: window.location.href,
        isFollowPage: window.location.href.includes('/following') || 
                      window.location.href.includes('/followers') ||
                      window.location.href.includes('/verified_followers'),
        pageType: window.location.href.includes('/following') ? 'following' : 
                  window.location.href.includes('/verified_followers') ? 'verified_followers' : 
                  window.location.href.includes('/followers') ? 'followers' : 'other',
        domStats: {
          totalElements: document.querySelectorAll('*').length,
          mainContentFound: !!document.querySelector('main[role="main"]'),
          timelineFound: !!document.querySelector('[aria-label="Timeline: Following"]') || 
                        !!document.querySelector('[aria-label="Timeline: Followers"]') ||
                        !!document.querySelector('[aria-label="Timeline: Verified Followers"]')
        },
        selectorResults: {}
      };
      
      // Test all our selectors
      const testSelectors = [
        '[data-testid="UserCell"]',
        '[data-testid="cellInnerDiv"]',
        'div[aria-label][role="button"]',
        'div[role="button"] a[role="link"][href^="/"]',
        'section[role="region"] div[role="button"]',
        'div.css-175oi2r[role="button"]',
        '[data-testid="primaryColumn"] div[role="button"]',
        '[aria-label="Timeline: Following"] div[role="button"]',
        '[aria-label="Timeline: Followers"] div[role="button"]',
        'main[role="main"] div[role="button"]',
        'span:contains("@")',
        'a[href^="/"]'
      ];
      
      // Test each selector and record results
      for (const selector of testSelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          const validElements = Array.from(elements).filter(el => {
            // Basic validation that this might be a user cell
            return el.textContent && el.textContent.trim() !== '';
          });
          
          debugInfo.selectorResults[selector] = {
            count: elements.length,
            validCount: validElements.length,
            sampleText: validElements.length > 0 ? validElements[0].textContent.trim().substring(0, 50) : 'N/A'
          };
        } catch (e) {
          debugInfo.selectorResults[selector] = { error: e.message };
        }
      }
      
      // Get a sample of potential user elements and try to extract usernames
      const sampleSelectors = ['[data-testid="UserCell"]', '[data-testid="cellInnerDiv"]', 'div[role="button"]'];
      let sampleElements = [];
      
      for (const selector of sampleSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          sampleElements = Array.from(elements).slice(0, 5);
          break;
        }
      }
      
      debugInfo.usernameSamples = [];
      for (const el of sampleElements) {
        try {
          const username = findUsername(el);
          const elHtml = el.outerHTML.substring(0, 500) + (el.outerHTML.length > 500 ? '...' : '');
          debugInfo.usernameSamples.push({
            username,
            isValid: !!username && /^[A-Za-z0-9_]{1,15}$/.test(username),
            html: elHtml
          });
        } catch (e) {
          debugInfo.usernameSamples.push({ error: e.message });
        }
      }
      
      // Update overlay
      debugOverlay.textContent = 'Debug analysis complete!';
      setTimeout(() => debugOverlay.remove(), 3000);
      
      return {
        success: true,
        debugInfo
      };
    } catch (error) {
      console.error('Debug extraction error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Finds and clicks the follow button on a profile page
   */
  async function clickFollowButton() {
    console.log('Looking for follow button...');
    
    // Wait for the page to fully load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      // Try multiple selectors to find the follow button
      let followButton = null;
      
      // Method 1: Using the exact data-testid pattern from your example (most specific)
      const specificDataTestIdButtons = document.querySelectorAll('button[data-testid$="-follow"]');
      console.log(`Found ${specificDataTestIdButtons.length} buttons with data-testid ending with -follow`);
      
      for (const button of specificDataTestIdButtons) {
        console.log('Examining button:', button.outerHTML);
        // Check if it contains the text "Follow" and not "Following"
        const buttonText = button.textContent.trim();
        if (buttonText.includes('Follow') && !buttonText.includes('Following')) {
          followButton = button;
          console.log('Found follow button by specific data-testid:', button);
          break;
        }
      }
      
      // Method 2: Using aria-label that starts with "Follow @"
      if (!followButton) {
        const ariaButtons = document.querySelectorAll('button[aria-label^="Follow @"]');
        console.log(`Found ${ariaButtons.length} buttons with aria-label starting with Follow @`);
        if (ariaButtons.length > 0) {
          followButton = ariaButtons[0];
          console.log('Found follow button by aria-label:', followButton);
        }
      }
      
      // Method 3: Using button text content
      if (!followButton) {
        const allButtons = document.querySelectorAll('button');
        for (const button of allButtons) {
          const buttonText = button.textContent.trim();
          if (buttonText === 'Follow' && !buttonText.includes('Following')) {
            followButton = button;
            console.log('Found follow button by text content:', followButton);
            break;
          }
        }
      }
      
      if (!followButton) {
        console.error('Follow button not found');
        // Debug output to help identify the button
        console.log('All buttons on page:');
        document.querySelectorAll('button').forEach((btn, i) => {
          console.log(`Button ${i}:`, {
            text: btn.textContent.trim(),
            dataTestId: btn.getAttribute('data-testid'),
            ariaLabel: btn.getAttribute('aria-label')
          });
        });
        return false;
      }
      
      console.log('Follow button found:', followButton);
      
      // Scroll the button into view
      followButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Wait a moment before clicking
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Click the button using a more direct method
      console.log('Clicking follow button...');
      
      // Try multiple click methods
      try {
        // Method 1: Standard click
        followButton.click();
        console.log('Standard click executed');
        
        // Wait to see if it worked
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if button changed
        const buttonChanged = !document.querySelector(`button[data-testid="${followButton.getAttribute('data-testid')}"]`)?.textContent.includes('Follow');
        
        if (!buttonChanged) {
          // Method 2: Dispatch mouse events
          console.log('Standard click failed, trying mouse events');
          followButton.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
          followButton.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));
          followButton.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        }
      } catch (e) {
        console.error('Error during click:', e);
      }
      
      // Wait to verify the follow action
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if the button text changed or disappeared
      const followButtons = document.querySelectorAll('button[data-testid$="-follow"]');
      let success = true;
      
      for (const btn of followButtons) {
        if (btn.textContent.includes('Follow') && !btn.textContent.includes('Following')) {
          success = false;
          break;
        }
      }
      
      console.log('Follow action successful:', success);
      
      return success;
    } catch (error) {
      console.error('Error clicking follow button:', error);
      return false;
    }
  }

  /**
   * Starts the process of following users from the queue
   */
  async function startFollowingUsers() {
    if (isFollowing) {
      return { success: false, error: 'Already following users' };
    }
    
    try {
      // Get users from queue
      const data = await chrome.storage.local.get('extractedUsers');
      const usersToFollow = data.extractedUsers || [];
      
      if (usersToFollow.length === 0) {
        return { success: false, error: 'No users in queue to follow' };
      }
      
      console.log(`Starting to follow ${usersToFollow.length} users`);
      createStatusOverlay(`Starting to follow ${usersToFollow.length} users`);
      
      isFollowing = true;
      currentFollowIndex = 0;
      
      // Start the follow process
      followNextUser(usersToFollow);
      
      return {
        success: true,
        message: `Started following ${usersToFollow.length} users`
      };
    } catch (error) {
      console.error('Error starting follow process:', error);
      isFollowing = false;
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Follows the next user in the queue
   */
  async function followNextUser(usersToFollow) {
    if (!isFollowing) {
      console.log('Follow process stopped');
      removeStatusOverlay();
      return;
    }
    
    if (currentFollowIndex >= usersToFollow.length) {
      console.log('Finished following all users in queue');
      updateStatusOverlay('Finished following all users in queue');
      setTimeout(removeStatusOverlay, 3000);
      isFollowing = false;
      return;
    }
    
    const user = usersToFollow[currentFollowIndex];
    console.log(`Following user ${currentFollowIndex + 1}/${usersToFollow.length}: @${user.username}`);
    updateStatusOverlay(`Following ${currentFollowIndex + 1}/${usersToFollow.length}: @${user.username}`);
    
    try {
      // Navigate to the user's profile
      const profileUrl = `https://twitter.com/${user.username}`;
      console.log(`Navigating to ${profileUrl}`);
      window.location.href = profileUrl;
      
      // Wait for navigation to complete
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check if we're on the right profile
      if (!window.location.href.includes(`/${user.username}`)) {
        console.error(`Failed to navigate to @${user.username}'s profile`);
        throw new Error(`Failed to navigate to profile`);
      }
      
      // Check if the profile exists
      if (document.body.textContent.includes("This account doesn't exist") || 
          document.body.textContent.includes("Account suspended")) {
        console.log(`@${user.username}'s account is unavailable`);
        await markUserAsProcessed(user.username, false);
        currentFollowIndex++;
        setTimeout(() => followNextUser(usersToFollow), getRandomDelay(2000, 4000));
        return;
      }
      
      // Check if already following
      const followingButtons = document.querySelectorAll('button[data-testid$="-unfollow"]');
      const isFollowingText = document.body.textContent.includes('Following');
      
      if (followingButtons.length > 0 || isFollowingText) {
        console.log(`Already following @${user.username}`);
        await markUserAsProcessed(user.username, true);
        currentFollowIndex++;
        setTimeout(() => followNextUser(usersToFollow), getRandomDelay(2000, 4000));
        return;
      }
      
      // Click the follow button
      const followSuccess = await clickFollowButton();
      console.log(`Follow success for @${user.username}: ${followSuccess}`);
      
      // Mark as processed
      await markUserAsProcessed(user.username, followSuccess);
      currentFollowIndex++;
      
      // Add a delay before moving to next user
      setTimeout(() => followNextUser(usersToFollow), getRandomDelay(3000, 5000));
    } catch (error) {
      console.error(`Error following @${user.username}:`, error);
      await markUserAsProcessed(user.username, false);
      currentFollowIndex++;
      
      // Continue with next user despite error
      setTimeout(() => followNextUser(usersToFollow), getRandomDelay(3000, 5000));
    }
  }

  /**
   * Marks a user as processed (either followed or skipped)
   */
  async function markUserAsProcessed(username, followed) {
    try {
      // Get storage data
      const data = await chrome.storage.local.get(['extractedUsers', 'followedUsers']);
      let extractedUsers = data.extractedUsers || [];
      let followedUsers = data.followedUsers || [];
      
      // Remove user from queue
      extractedUsers = extractedUsers.filter(user => user.username !== username);
      
      // If successfully followed, add to followed users list
      if (followed) {
        // Make sure the user isn't already in the followed list
        if (!followedUsers.some(user => user.username === username)) {
          // Try to find user details from extracted list before it's filtered
          const userDetails = data.extractedUsers.find(user => user.username === username) || {};
          
          followedUsers.push({
            username,
            profileUrl: userDetails.profileUrl || `https://x.com/${username}`,
            displayName: userDetails.displayName || '',
            followedAt: new Date().toISOString(),
            isFollowing: false, // We don't know if they follow back yet
            unfollowedAt: null
          });
        }
      }
      
      // Save updated lists back to storage
      await chrome.storage.local.set({
        extractedUsers,
        followedUsers
      });
      
      return true;
    } catch (error) {
      console.error(`Error marking ${username} as processed:`, error);
      return false;
    }
  }

  /**
   * Generates a random delay between min and max milliseconds
   */
  function getRandomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Test function that can be called from the browser console to find follow buttons without
   * running the full follow process. Use: window.testFindFollowButton()
   */
  window.testFindFollowButton = function() {
    try {
      // First ensure we're on a profile page
      if (!window.location.pathname.match(/^\/[A-Za-z0-9_]{1,15}$/)) {
        console.error('Not on a profile page. Please navigate to a Twitter/X profile first.');
        return false;
      }
      
      const username = window.location.pathname.substring(1);
      console.log(`Testing follow button detection for @${username}`);
      
      // Show a visual indicator
      createStatusOverlay(`Testing follow button detection for @${username}...`);
      
      // List all buttons in DOM for reference
      console.log('All buttons in the DOM:');
      const allButtons = document.querySelectorAll('button');
      console.log(`Found ${allButtons.length} total buttons`);
      
      // Log first 5 buttons
      Array.from(allButtons).slice(0, 5).forEach((btn, i) => {
        console.log(`Button ${i}:`, {
          text: btn.textContent?.trim(),
          dataTestId: btn.getAttribute('data-testid'),
          ariaLabel: btn.getAttribute('aria-label')
        });
      });
      
      // Highlight all potential follow buttons with a colored border
      const highlightButton = (button, color) => {
        // Save original styles
        const originalOutline = button.style.outline;
        const originalOutlineOffset = button.style.outlineOffset;
        
        // Apply highlight
        button.style.outline = `3px solid ${color}`;
        button.style.outlineOffset = '2px';
        
        // Log
        console.log(`Highlighted button with ${color}:`, {
          text: button.textContent?.trim(),
          dataTestId: button.getAttribute('data-testid'),
          ariaLabel: button.getAttribute('aria-label')
        });
        
        // Return function to restore original styles
        return () => {
          button.style.outline = originalOutline;
          button.style.outlineOffset = originalOutlineOffset;
        };
      };
      
      const restorations = [];
      
      // Method 1: By data-testid (most reliable)
      console.log('Method 1: Searching by data-testid');
      const possibleTestIds = ['-follow', 'follow', 'user-follow-button'];
      for (const testId of possibleTestIds) {
        const buttons = document.querySelectorAll(`button[data-testid*="${testId}"]`);
        console.log(`Found ${buttons.length} buttons with data-testid containing "${testId}"`);
        
        for (const btn of buttons) {
          if (btn.getAttribute('data-testid')?.includes('unfollow')) {
            // Skip unfollow buttons
            console.log('Skipping unfollow button:', btn.getAttribute('data-testid'));
            continue;
          }
          
          const btnText = btn.textContent?.trim().toLowerCase();
          if (btnText && (btnText.includes('following') || btnText.includes('unfollow'))) {
            // Skip buttons with Following/Unfollow text
            console.log('Skipping button with text containing following/unfollow:', btnText);
            continue;
          }
          
          // Found potential follow button with this approach
          restorations.push(highlightButton(btn, 'green'));
        }
      }
      
      // Method 2: By aria-label (pretty reliable)
      console.log('Method 2: Searching by aria-label');
      const ariaButtons = document.querySelectorAll('button[aria-label*="Follow"]');
      console.log(`Found ${ariaButtons.length} buttons with aria-label containing "Follow"`);
      
      for (const btn of ariaButtons) {
        const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase();
        if (ariaLabel && !ariaLabel.includes('following') && !ariaLabel.includes('unfollow')) {
          // Found potential follow button with this approach
          restorations.push(highlightButton(btn, 'blue'));
        }
      }
      
      // Method 3: By text content (less reliable)
      console.log('Method 3: Searching by text content');
      for (const btn of allButtons) {
        const btnText = btn.textContent?.trim().toLowerCase();
        if (btnText === 'follow') {
          // Found potential follow button with this approach
          restorations.push(highlightButton(btn, 'purple'));
        }
      }
      
      // Method 4: By Twitter-specific selectors
      console.log('Method 4: Searching by Twitter-specific selectors');
      const cssSelectors = [
        'div[data-testid="primaryColumn"] button', // Primary column buttons
        'aside div[role="button"]', // Side panel buttons
        'div[data-testid="placementTracking"] button', // Tracking div buttons
        'div.css-175oi2r button', // Twitter specific CSS class
        'div.r-14lw9ot button', // Another Twitter specific class
      ];
      
      for (const selector of cssSelectors) {
        const potentialButtons = document.querySelectorAll(selector);
        console.log(`Found ${potentialButtons.length} buttons with selector: ${selector}`);
        
        for (const btn of potentialButtons) {
          // Skip if it's clearly not a follow button
          if (!btn.textContent || btn.textContent.length > 20) continue;
          
          const btnText = btn.textContent.trim().toLowerCase();
          // A real follow button should contain "follow" but not "following"/"unfollow"
          if (btnText.includes('follow') && !btnText.includes('following') && !btnText.includes('unfollow')) {
            // Found potential follow button with this approach
            restorations.push(highlightButton(btn, 'orange'));
          }
        }
      }
      
      // Summary
      const totalHighlighted = restorations.length;
      updateStatusOverlay(`Found ${totalHighlighted} potential follow buttons!`);
      
      if (totalHighlighted === 0) {
        console.error('Could not find any potential follow buttons on this page.');
        setTimeout(removeStatusOverlay, 5000);
        return false;
      }
      
      // Restore original styles after 10 seconds
      setTimeout(() => {
        restorations.forEach(restore => restore());
        removeStatusOverlay();
        console.log('Follow button highlighting removed');
      }, 10000);
      
      return true;
    } catch (error) {
      console.error('Error testing follow button detection:', error);
      updateStatusOverlay(`Error: ${error.message}`);
      setTimeout(removeStatusOverlay, 5000);
      return false;
    }
  };

  /**
   * Test function to find elements by any CSS selector
   * Can be called from the browser console: window.testSelector('button[data-testid*="follow"]')
   */
  window.testSelector = function(selector) {
    try {
      console.log(`Testing selector: "${selector}"`);
      const elements = document.querySelectorAll(selector);
      
      if (elements.length === 0) {
        console.log('No elements found with this selector');
        return false;
      }
      
      console.log(`Found ${elements.length} elements with selector`);
      
      // Store original outlines
      const originals = [];
      
      // Highlight each element
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        
        // Store original styles
        originals.push({
          element,
          outline: element.style.outline,
          outlineOffset: element.style.outlineOffset
        });
        
        // Apply highlight - use different colors for each element (up to 5 colors)
        const colors = ['red', 'green', 'blue', 'purple', 'orange'];
        const color = colors[i % colors.length];
        element.style.outline = `3px solid ${color}`;
        element.style.outlineOffset = '2px';
        
        // Log details about this element
        console.log(`Element #${i + 1}:`, {
          tagName: element.tagName.toLowerCase(),
          id: element.id || '(no id)',
          className: element.className || '(no class)',
          textContent: element.textContent?.trim().substring(0, 50) || '(no text)',
          testId: element.getAttribute('data-testid') || '(no data-testid)',
          ariaLabel: element.getAttribute('aria-label') || '(no aria-label)'
        });
      }
      
      // Create visual feedback
      createStatusOverlay(`Found ${elements.length} elements with selector: "${selector}"`);
      
      // Restore original styles after 10 seconds
      setTimeout(() => {
        originals.forEach(item => {
          item.element.style.outline = item.outline;
          item.element.style.outlineOffset = item.outlineOffset;
        });
        
        removeStatusOverlay();
        console.log('Element highlighting removed');
      }, 10000);
      
      return elements;
    } catch (error) {
      console.error('Error testing selector:', error);
      return false;
    }
  };

  /**
   * Manually initialize debug UI - can be called from console
   */
  window.initDebugUI = function() {
    console.log('Manually initializing debug UI from console');
    try {
      // First try to use the follow agent's function directly
      if (typeof window.followAgentFunctionsAvailable !== 'undefined') {
        console.log('follow-agent.js detected, attempting to show debug UI');
        
        // Use the exposed functions from follow-agent.js
        if (typeof window.initDebugLogger === 'function') {
          // Use the integrated debug logger
          window.initDebugLogger();
          console.log('Initialized debug logger within the agent overlay');
          
          // Make sure the overlay is visible
          if (typeof window.createAgentOverlay === 'function') {
            window.createAgentOverlay('Debug mode activated');
          }
          
          // Show the debug log
          if (typeof window.toggleDebugVisibility === 'function') {
            window.toggleDebugVisibility(true);
          }
          
          console.log('Debug UI successfully initialized and activated');
          return true;
        }
      }
      
      console.log('Standard approach failed, falling back to manual debug UI');
      createManualDebugUI();
      return true;
    } catch (error) {
      console.error('Error initializing debug UI:', error);
      // Fallback to a very basic UI
      createManualDebugUI();
      return false;
    }
  };
  
  /**
   * Creates a manual debug UI if the main one fails
   */
  function createManualDebugUI() {
    console.log('Creating standalone debug UI');
    
    // Remove any existing debug UI
    const existingUI = document.getElementById('x-growth-manual-debug');
    if (existingUI) {
      existingUI.remove();
    }
    
    // Create container
    const debugUI = document.createElement('div');
    debugUI.id = 'x-growth-manual-debug';
    debugUI.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      background-color: rgba(29, 161, 242, 0.9);
      color: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      z-index: 9999;
      max-width: 400px;
      width: 380px;
      display: flex;
      flex-direction: column;
    `;
    
    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 10px 15px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    
    const title = document.createElement('div');
    title.textContent = 'X Growth Agent Debug';
    title.style.fontWeight = 'bold';
    
    const controls = document.createElement('div');
    
    // Toggle button for log visibility
    const toggleLogBtn = document.createElement('button');
    toggleLogBtn.textContent = 'Hide Log';
    toggleLogBtn.style.cssText = `
      background: rgba(0, 0, 0, 0.3);
      color: white;
      border: none;
      border-radius: 4px;
      padding: 4px 8px;
      margin-right: 8px;
      cursor: pointer;
      font-size: 12px;
    `;
    
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'X';
    closeBtn.style.cssText = `
      background: rgba(0, 0, 0, 0.3);
      color: white;
      border: none;
      border-radius: 4px;
      width: 24px;
      height: 24px;
      cursor: pointer;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    controls.appendChild(toggleLogBtn);
    controls.appendChild(closeBtn);
    
    header.appendChild(title);
    header.appendChild(controls);
    
    // Status section
    const status = document.createElement('div');
    status.style.cssText = `
      padding: 10px 15px;
    `;
    
    const statusText = document.createElement('div');
    statusText.innerHTML = '<strong>Manual Debug Console</strong>';
    statusText.style.marginBottom = '8px';
    
    const detailsContainer = document.createElement('div');
    detailsContainer.style.cssText = `
      font-size: 12px;
      line-height: 1.5;
    `;
    
    // Gather some basic debug info
    const details = [
      `Current URL: ${window.location.href}`,
      `follow-agent.js loaded: ${typeof window.xGrowthAgentFollowAgentLoaded !== 'undefined'}`,
      `content.js loaded: ${typeof window.xGrowthAgentContentLoaded !== 'undefined'}`,
      `agent functions available: ${typeof window.followAgentFunctionsAvailable !== 'undefined'}`,
      `startAgent function: ${typeof window.startAgent === 'function'}`,
      `DOM ready state: ${document.readyState}`
    ];
    
    detailsContainer.innerHTML = details.join('<br>');
    
    status.appendChild(statusText);
    status.appendChild(detailsContainer);
    
    // Log container
    const logContainer = document.createElement('div');
    logContainer.id = 'x-growth-manual-debug-log';
    logContainer.style.cssText = `
      max-height: 300px;
      overflow-y: auto;
      font-family: monospace;
      font-size: 12px;
      padding: 10px 15px;
      background-color: rgba(0, 0, 0, 0.2);
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      color: #eee;
    `;
    
    // Actions section
    const actions = document.createElement('div');
    actions.style.cssText = `
      padding: 10px 15px;
      display: flex;
      gap: 10px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    `;
    
    // Test follow button
    const testFollowBtn = document.createElement('button');
    testFollowBtn.textContent = 'Test Follow Button';
    testFollowBtn.style.cssText = `
      background: #ff4500;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px;
      flex: 1;
      cursor: pointer;
      font-size: 12px;
      font-weight: bold;
    `;
    
    // Test selectors
    const testSelectorsBtn = document.createElement('button');
    testSelectorsBtn.textContent = 'Test Selectors';
    testSelectorsBtn.style.cssText = `
      background: #1DA1F2;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px;
      flex: 1;
      cursor: pointer;
      font-size: 12px;
      font-weight: bold;
    `;
    
    actions.appendChild(testFollowBtn);
    actions.appendChild(testSelectorsBtn);
    
    // Assemble the debug UI
    debugUI.appendChild(header);
    debugUI.appendChild(status);
    debugUI.appendChild(logContainer);
    debugUI.appendChild(actions);
    
    // Add event listeners
    closeBtn.addEventListener('click', () => {
      debugUI.remove();
    });
    
    let logVisible = true;
    toggleLogBtn.addEventListener('click', () => {
      if (logVisible) {
        logContainer.style.display = 'none';
        toggleLogBtn.textContent = 'Show Log';
      } else {
        logContainer.style.display = 'block';
        toggleLogBtn.textContent = 'Hide Log';
      }
      logVisible = !logVisible;
    });
    
    testFollowBtn.addEventListener('click', () => {
      // Log the action
      addToManualLog('Follow button test executed. Check browser console for results.');
      
      // Try to use the agent's test function
      if (typeof window.testFindFollowButton === 'function') {
        window.testFindFollowButton();
      } else {
        console.warn('testFindFollowButton function not available');
        addToManualLog('Error: testFindFollowButton function not available');
        
        // Check if we're on a profile page
        if (!window.location.pathname.match(/^\/[A-Za-z0-9_]{1,15}$/)) {
          addToManualLog('Not on a profile page. Please navigate to a Twitter/X profile first.');
        }
      }
    });
    
    testSelectorsBtn.addEventListener('click', () => {
      const selector = prompt('Enter a CSS selector to test:', 'button[data-testid*="follow"]');
      if (selector) {
        addToManualLog(`Testing selector: ${selector}`);
        
        if (typeof window.testSelector === 'function') {
          window.testSelector(selector);
        } else {
          // Fallback if the agent's function is not available
          const elements = document.querySelectorAll(selector);
          addToManualLog(`Found ${elements.length} elements matching selector`);
          
          if (elements.length > 0) {
            elements.forEach((el, i) => {
              if (i < 5) {
                el.style.outline = '3px solid red';
                setTimeout(() => {
                  el.style.outline = '';
                }, 5000);
              }
            });
            
            elements[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
            addToManualLog(`Highlighted first ${Math.min(5, elements.length)} elements for 5 seconds`);
          }
        }
      }
    });
    
    // Function to add log entries
    function addToManualLog(message) {
      const logEntry = document.createElement('div');
      logEntry.textContent = message;
      logEntry.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
      logEntry.style.padding = '4px 0';
      
      // Add to the top of the log
      logContainer.insertBefore(logEntry, logContainer.firstChild);
    }
    
    // Add to page
    document.body.appendChild(debugUI);
    console.log('Manual debug UI created');
    
    // Add initial log entry
    addToManualLog('Run window.testFindFollowButton() in browser console to test follow button detection');
    
    // Attach the log function to window for external access
    window.addToManualLog = addToManualLog;
  }
} 
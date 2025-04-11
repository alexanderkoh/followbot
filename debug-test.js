/**
 * X Growth Agent Debug Test Script
 * Run this in your browser console on Twitter/X to test the debug UI
 */

console.log('%cX Growth Agent Debug Test', 'color: #ff4500; font-size: 20px; font-weight: bold;');
console.log('Checking environment and initializing debug tools...');

// Check if the page is on Twitter/X
if (!window.location.hostname.includes('twitter.com') && !window.location.hostname.includes('x.com')) {
  console.error('Error: This script must be run on Twitter or X.com');
  throw new Error('Please navigate to Twitter/X first');
}

// Check if content script is loaded
const contentLoaded = typeof window.xGrowthAgentContentLoaded !== 'undefined';
const followAgentLoaded = typeof window.xGrowthAgentFollowAgentLoaded !== 'undefined';
const agentFunctionsAvailable = typeof window.followAgentFunctionsAvailable !== 'undefined';

console.log(`Content script loaded: ${contentLoaded}`);
console.log(`Follow agent loaded: ${followAgentLoaded}`);
console.log(`Agent functions available: ${agentFunctionsAvailable}`);

// Initialize debug UI if possible
if (typeof window.initDebugUI === 'function') {
  console.log('Initializing debug UI via initDebugUI function...');
  const result = window.initDebugUI();
  if (result) {
    console.log('Debug UI successfully initialized');
    
    // Check if we also need to activate the debug log
    if (typeof window.toggleDebugVisibility === 'function') {
      window.toggleDebugVisibility(true);
      console.log('Activated debug log via toggleDebugVisibility');
    }
  } else {
    console.warn('Debug UI initialization returned false');
  }
} else {
  console.log('initDebugUI function not found, trying direct agent methods...');
  
  // Try direct agent methods if they exist
  if (typeof window.createAgentOverlay === 'function') {
    window.createAgentOverlay('Debug Test Running');
    console.log('Created agent overlay directly');
  } else {
    // Fallback to very basic overlay
    console.log('No debug functions found, creating basic debug overlay');
    
    // Create a simple debug interface if the official one isn't available
    const debugOverlay = document.createElement('div');
    debugOverlay.id = 'x-growth-debug-test-overlay';
    debugOverlay.style.cssText = `
      position: fixed;
      bottom: 60px;
      left: 20px;
      background-color: rgba(29, 161, 242, 0.9);
      color: white;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      padding: 12px 16px;
      z-index: 9999;
      width: auto;
      max-width: 400px;
    `;
    
    const title = document.createElement('div');
    title.textContent = 'X Growth Agent Debug';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '10px';
    
    const status = document.createElement('div');
    status.innerHTML = `
      <div>Content script loaded: ${contentLoaded ? '✓' : '✗'}</div>
      <div>Follow agent loaded: ${followAgentLoaded ? '✓' : '✗'}</div>
      <div>Agent functions available: ${agentFunctionsAvailable ? '✓' : '✗'}</div>
    `;
    
    const buttonContainer = document.createElement('div');
    buttonContainer.style.marginTop = '10px';
    
    const testBtn = document.createElement('button');
    testBtn.textContent = 'Test Follow Button';
    testBtn.style.cssText = `
      background-color: #ff4500;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 6px 12px;
      font-size: 14px;
      cursor: pointer;
      margin-right: 8px;
    `;
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = `
      background-color: rgba(0, 0, 0, 0.3);
      color: white;
      border: none;
      border-radius: 4px;
      padding: 6px 12px;
      font-size: 14px;
      cursor: pointer;
    `;
    
    testBtn.addEventListener('click', () => {
      try {
        if (typeof window.testFindFollowButton === 'function') {
          window.testFindFollowButton();
          status.innerHTML += '<div style="color: #ddeeff; margin-top: 8px;">Follow button test started. Check for highlighted buttons.</div>';
        } else {
          status.innerHTML += '<div style="color: #ffdddd; margin-top: 8px;">Error: Follow button test function not available.</div>';
        }
      } catch (error) {
        status.innerHTML += `<div style="color: #ffdddd; margin-top: 8px;">Error running test: ${error.message}</div>`;
      }
    });
    
    closeBtn.addEventListener('click', () => {
      debugOverlay.remove();
    });
    
    buttonContainer.appendChild(testBtn);
    buttonContainer.appendChild(closeBtn);
    
    debugOverlay.appendChild(title);
    debugOverlay.appendChild(status);
    debugOverlay.appendChild(buttonContainer);
    
    document.body.appendChild(debugOverlay);
  }
}

// Test the follow button detection if we're on a profile page
const isProfilePage = window.location.pathname.match(/^\/[A-Za-z0-9_]{1,15}$/);
if (isProfilePage) {
  console.log('Detected profile page, running follow button test...');
  
  // Wait a bit for page to fully load
  setTimeout(() => {
    if (typeof window.testFindFollowButton === 'function') {
      window.testFindFollowButton();
    } else {
      console.warn('testFindFollowButton function not available, cannot test follow button detection');
    }
  }, 1500);
} else {
  console.log('Not on a profile page. Navigate to a Twitter user profile to test follow button detection.');
}

console.log('%cDebug test completed', 'color: #ff4500; font-size: 16px; font-weight: bold;');
console.log('The debug UI should now be visible in the bottom left of your screen.'); 
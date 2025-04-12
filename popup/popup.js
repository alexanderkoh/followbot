document.addEventListener('DOMContentLoaded', function() {
  // --- DOM Elements ---
  const statusMessage = document.getElementById('status-message');
  const queueCount = document.getElementById('queue-count'); // Now user-count
  const userCountSpan = document.getElementById('user-count');
  const userListContainer = document.getElementById('user-list');
  const searchInput = document.getElementById('search-input');
  const settingsBtn = document.getElementById('settings-btn');
  const debugBtn = document.getElementById('debug-btn');
  const debugInstructions = document.getElementById('debug-instructions');

  // Extraction Elements
  const extractUsernamesBtn = document.getElementById('extract-usernames');
  const scrollOptions = document.getElementsByName('scroll-option');
  
  // Tab Elements
  const tabExtract = document.getElementById('tab-extract');
  const tabManage = document.getElementById('tab-manage');
  const tabAgent = document.getElementById('tab-agent');
  const tabMetrics = document.getElementById('tab-metrics');
  const tabTest = document.querySelector('.tab[data-tab="test"]'); // Use data attribute selector
  const testContent = document.getElementById('test-content');
  const testUsernameInput = document.getElementById('test-username');
  const testDelayInput = document.getElementById('test-delay');
  const testDelayUnitSelect = document.getElementById('test-delay-unit');
  const runTestBtn = document.getElementById('run-test-btn');
  const testStatusLog = document.getElementById('test-status-log');
  const testResultsLog = document.getElementById('test-results-log');
  const testErrorMessage = document.getElementById('test-error-message');
  const extractUsersContent = document.getElementById('extract-users-content');
  const userManagementContent = document.getElementById('user-management-content'); // Renamed from all-users-content
  const agentContent = document.getElementById('agent-content');
  const metricsContent = document.getElementById('metrics-content');

  // User List Elements
  const filterButtons = document.querySelectorAll('.filter-btn');
  const refreshListBtn = document.getElementById('refresh-list');
  const clearQueueBtn = document.getElementById('clear-queue'); // Will clear only 'Queued'
  const exportUsersBtn = document.getElementById('export-users');

  // Agent Control Elements
  const startAgentBtn = document.getElementById('start-agent');
  const stopAgentBtn = document.getElementById('stop-agent');
  const openSettingsLink = document.getElementById('open-settings'); // Link in HTML now goes directly
  const agentStatusIndicator = document.getElementById('agent-status-indicator');
  const statusText = agentStatusIndicator ? agentStatusIndicator.querySelector('.status-text') : null;
  const dailyFollowCount = document.getElementById('daily-follow-count');
  const dailyUnfollowCount = document.getElementById('daily-unfollow-count');
  const totalFollowCount = document.getElementById('total-follow-count'); // Now 'Currently Following'
  const followLimit = document.getElementById('follow-limit');
  const currentAction = document.getElementById('current-action');

  // <<< NEW: List URL Extraction Elements >>>
  const listUrlInput = document.getElementById('list-url-input');
  const extractFromListUrlBtn = document.getElementById('extract-from-list-url');

  // <<< NEW: Community URL Extraction Elements >>>
  const communityUrlInput = document.getElementById('community-url-input');
  const extractFromCommunityUrlBtn = document.getElementById('extract-from-community-url');

  // --- State Variables ---
  let allUsersData = []; // Combined list { username, displayName, profileUrl, status, extractedAt, followedAt, unfollowedAt }
  let currentFilter = 'all'; // 'all', 'queued', 'followed', 'unfollowed'

  // --- Initialization ---
  init();
  
  // --- Event Listeners ---
  
  // --- Functions ---
  async function init() {
    console.log("Initializing popup script...");
    let activeTabName = null; // Use a local variable for init scope
    const tabButtons = document.querySelectorAll('.tabs .tab[data-tab]');

    if (tabButtons.length > 0) {
      // Set default active tab to the first one found
      activeTabName = tabButtons[0].dataset.tab;
      console.log(`Default active tab determined: ${activeTabName}`);

      // Add event listeners to all tab buttons
      tabButtons.forEach(button => {
        // Check if listener already exists (simple check, might not be foolproof)
        if (!button.dataset.listenerAttached) { 
          button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            console.log(`Tab button clicked: ${tabName}`);
            if (tabName) {
              switchTab(tabName);
            }
          });
          button.dataset.listenerAttached = 'true'; // Mark as attached
        } else {
             console.log(`Listener already attached to tab: ${button.dataset.tab}`);
        }
      });
      console.log(`Attached click listeners to ${tabButtons.length} tab buttons.`);
    } else {
      console.error("No tab buttons found with 'data-tab' attribute!");
      showStatus('Error: UI tabs could not be initialized.', 'error');
      return; // Stop initialization
    }

    // Attach other event listeners safely using optional chaining (?)
    console.log("Attaching listeners for other controls...");
    document.getElementById('extract-usernames')?.addEventListener('click', handleExtractUsernames);
    document.getElementById('clear-queue')?.addEventListener('click', handleClearQueue);
    document.getElementById('refresh-list')?.addEventListener('click', loadAndDisplayUsers);
    document.getElementById('search-input')?.addEventListener('input', displayFilteredUserList);
    document.getElementById('export-users')?.addEventListener('click', exportUsersToCsv);
    document.getElementById('debug-btn')?.addEventListener('click', handleDebug);
    document.getElementById('settings-btn')?.addEventListener('click', () => {
        console.log('Settings button clicked.');
        try {
          const settingsUrl = chrome.runtime.getURL('popup/settings.html');
          console.log('Attempting to open settings URL:', settingsUrl);
          chrome.tabs.create({ url: settingsUrl });
        } catch (error) {
          console.error('Error opening settings page:', error);
          showStatus(`Error opening settings: ${error.message}`, 'error');
        }
    });
    document.getElementById('extract-from-list-url')?.addEventListener('click', handleExtractFromListUrl);
    document.getElementById('extract-from-community-url')?.addEventListener('click', handleExtractFromCommunityUrl);
    document.getElementById('start-agent')?.addEventListener('click', handleStartAgent);
    document.getElementById('stop-agent')?.addEventListener('click', handleStopAgent);
    document.getElementById('run-test-btn')?.addEventListener('click', handleRunTest);
    document.getElementById('settings-form')?.addEventListener('submit', saveSettings);
    
    // Attach listeners for filter buttons
    document.querySelectorAll('.filter-btn').forEach(button => {
      if (!button.dataset.listenerAttached) {
          button.addEventListener('click', () => {
            currentFilter = button.dataset.filter;
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            displayFilteredUserList();
          });
          button.dataset.listenerAttached = 'true';
      }
    });
    console.log("Attached listeners for filter buttons.");
    
    // Activate the default tab determined earlier
    if (activeTabName) {
       console.log(`Activating default tab: ${activeTabName}`);
       switchTab(activeTabName);
    } else {
        console.error("Could not determine a default tab to activate.");
        // Fallback or error display might be needed
        showStatus("Error: Could not activate default UI tab.", 'error');
        return;
    }
    
    // Load initial data based on the active tab after switching
    // (switchTab function already handles this)
    // Example: 
    // if (activeTabName === 'user-management') await loadAndDisplayUsers(); 
    // if (activeTabName === 'agent-status') await updateAgentStatus();
    console.log("Initial data load triggered by switchTab.");

    // Set up polling intervals (ensure querySelectors use correct attributes)
    console.log("Setting up polling intervals...");
    setInterval(async () => {
      const agentStatusTabElement = document.querySelector('.tab[data-tab="agent-status"]');
      if (agentStatusTabElement && agentStatusTabElement.classList.contains('active')) {
        await updateAgentStatus();
      }
    }, 3000);

    setInterval(async () => {
        const userManagementTabElement = document.querySelector('.tab[data-tab="user-management"]');
        const searchInput = document.getElementById('search-input'); 
        if (userManagementTabElement && userManagementTabElement.classList.contains('active')) {
            if (document.activeElement !== searchInput) {
                await loadAndDisplayUsers();
            }
        }
    }, 5000);
    console.log("Polling intervals set.");

    // Listener for messages from background (test logs)
    console.log("Setting up listener for background messages...");
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log("Popup received message:", message);
        const runTestBtn = document.getElementById('run-test-btn'); // Get button ref inside listener
        const testStatusLog = document.getElementById('test-status-log'); // Get log ref inside listener
        const testResultsLog = document.getElementById('test-results-log'); // Get log ref inside listener

        if (message.type === 'testLog' && message.log) {
            appendLog(testStatusLog, message.log);
        } else if (message.type === 'testResult' && message.log) {
            appendLog(testResultsLog, message.log);
            if (runTestBtn) { runTestBtn.disabled = false; runTestBtn.textContent = 'Run Test'; }
        } else if (message.type === 'testError' && message.error) {
            showTestError(message.error);
             if (runTestBtn) { runTestBtn.disabled = false; runTestBtn.textContent = 'Run Test'; }
        } else if (message.type === 'testComplete') {
             if (runTestBtn) { runTestBtn.disabled = false; runTestBtn.textContent = 'Run Test'; }
        }
    });
    console.log("Background message listener attached.");
    console.log("Popup initialization complete.");
  }
  
  function switchTab(tabName) {
    console.log(`Switching to tab: ${tabName}`);
    
    // Deactivate all tabs and content
    document.querySelectorAll('.tabs .tab[data-tab]').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // Activate the selected tab and content
    const tabElement = document.querySelector(`.tab[data-tab="${tabName}"]`);
    const contentElement = document.getElementById(`${tabName}-content`);

    if (tabElement) {
      tabElement.classList.add('active');
       console.log(`Added 'active' class to tab button: ${tabName}`);
    } else {
        console.warn(`Tab button element not found for data-tab: ${tabName}`);
    }

    if (contentElement) {
      contentElement.classList.add('active');
       console.log(`Added 'active' class to content area: #${contentElement.id}`);
    } else {
        console.warn(`Content element not found for ID: ${tabName}-content`);
    }

    // --- RESTORED DATA LOADING LOGIC --- 
    console.log(`Running refresh logic for tab: ${tabName}`);
    setTimeout(() => {
       console.log(`Executing delayed refresh for tab: ${tabName}`);
      if (tabName === 'user-management') {
         loadAndDisplayUsers();
      } else if (tabName === 'agent-status') {
         updateAgentStatus();
      } else if (tabName === 'metrics') {
         displayMetrics();
      } 
      // Add other potentially complex data loading functions here if needed
      
    }, 50); // <<< Increased delay to 50ms >>>

    // Handle simple/immediate UI updates outside the timeout
    if (tabName === 'logs') {
        // fetchLogs(); // Assuming this might load data, could also be delayed
    } else if (tabName === 'settings') {
        // loadSettings(); // Assuming this might load data, could also be delayed
        loadSettings();
    } else if (tabName === 'test') {
        // This logic is simple UI reset, likely fine without delay
        const testStatusLog = document.getElementById('test-status-log');
        const testResultsLog = document.getElementById('test-results-log');
        if(testStatusLog) testStatusLog.textContent = 'Test status will appear here...';
        if(testResultsLog) testResultsLog.textContent = 'Detailed test results will appear here...';
        hideTestError(); 
    } 
    console.log(`Finished switchTab function for: ${tabName}`);
    // --- END RESTORED LOGIC --- 
  }

  // Refactored: Load data from storage and prepare combined list
  async function loadUserData() {
      // Added check for userListContainer existence
      const userListContainer = document.getElementById('user-list');
      if (!userListContainer) {
          console.warn('loadUserData called but user list container not found.');
          return; // Don't proceed if the container isn't there
      }
      try {
           const data = await chrome.storage.local.get(['extractedUsers', 'followedUsers']);
           console.log('[loadUserData] Data read from storage:', data);
           const extractedUsers = data.extractedUsers || [];
       const followedUsers = data.followedUsers || [];
           allUsersData = [];

          // Process followed users first to easily check status
          const followedMap = new Map();
          followedUsers.forEach(user => {
              const status = user.unfollowedAt ? 'unfollowed' : 'followed';
              allUsersData.push({ ...user, status });
              followedMap.set(user.username, status);
          });

          // Process extracted users, adding only those not already processed (followed/unfollowed)
          extractedUsers.forEach(user => {
              if (!followedMap.has(user.username)) {
                  allUsersData.push({ ...user, status: 'queued' });
              }
          });

          // Sort by date (most recent first - use relevant date based on status)
          allUsersData.sort((a, b) => {
             const dateA = new Date(a.unfollowedAt || a.followedAt || a.extractedAt || 0);
             const dateB = new Date(b.unfollowedAt || b.followedAt || b.extractedAt || 0);
             return dateB - dateA;
          });
      
    } catch (error) {
          console.error('Error loading user data:', error);
          showStatus(`Error loading user data: ${error.message}`, 'error');
          allUsersData = []; // Ensure it's an empty array on error
      }
  }

  // Refactored: Load data and then trigger display
  async function loadAndDisplayUsers() {
      // Added checks for relevant elements
      const userListContainer = document.getElementById('user-list');
      const searchInput = document.getElementById('search-input');
      if (!userListContainer || !searchInput) {
          console.warn('loadAndDisplayUsers called but required elements not found.');
          return;
      }
      // Add check to preserve search input value
      const currentSearchValue = searchInput.value;
      await loadUserData();
      searchInput.value = currentSearchValue; // Restore search value
      displayFilteredUserList(); // Display based on current filter and search
  }

  // Refactored: Filter and render the user list based on current state
  function displayFilteredUserList() {
      // Added checks for relevant elements
      const userListContainer = document.getElementById('user-list');
      const searchInput = document.getElementById('search-input');
       if (!userListContainer || !searchInput) {
          console.warn('displayFilteredUserList called but required elements not found.');
          return;
      }
    const searchTerm = searchInput.value.toLowerCase().trim();

    // 1. Filter by Status
    let statusFilteredUsers = allUsersData;
    if (currentFilter !== 'all') {
      statusFilteredUsers = allUsersData.filter(user => user.status === currentFilter);
    }

    // 2. Filter by Search Term
    let searchFilteredUsers = statusFilteredUsers;
    if (searchTerm) {
      searchFilteredUsers = statusFilteredUsers.filter(user =>
        user.username.toLowerCase().includes(searchTerm) ||
        (user.displayName && user.displayName.toLowerCase().includes(searchTerm))
      );
    }

    // 3. Render List
    userListContainer.innerHTML = ''; // Clear previous list

    if (searchFilteredUsers.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      if (allUsersData.length === 0) {
          emptyState.textContent = 'No users loaded yet. Extract some users!';
      } else if (statusFilteredUsers.length === 0) {
           emptyState.textContent = `No users with status "${currentFilter}".`;
      }
      else {
        emptyState.textContent = 'No users match your search.';
      }
      userListContainer.appendChild(emptyState);
    } else {
      searchFilteredUsers.forEach(user => {
        const userItem = createUserListItem(user);
        userListContainer.appendChild(userItem);
      });
    }

    // 4. Update Count Display
    updateUserCount(searchFilteredUsers.length, statusFilteredUsers.length);
  }

  // Helper function to create a single user list item
  function createUserListItem(user) {
      const userItem = document.createElement('div');
      userItem.className = 'user-item';

      // Status Badge
      const userStatus = document.createElement('span');
      userStatus.className = `user-status-badge status-${user.status}`;
      userStatus.textContent = user.status;

      // Details
      const userDetails = document.createElement('div');
      userDetails.className = 'user-details';

      const userNameDiv = document.createElement('div'); // Wrapper for name and badge
      userNameDiv.style.display = 'flex';
      userNameDiv.style.alignItems = 'center';

      const userName = document.createElement('div');
      userName.className = 'user-name';
      userName.textContent = user.displayName || user.username;
      userName.title = user.displayName || user.username; // Tooltip for long names

      userNameDiv.appendChild(userName);
      userNameDiv.appendChild(userStatus); // Add badge after name

      const userHandle = document.createElement('div');
      userHandle.className = 'user-handle';
      userHandle.textContent = `@${user.username}`;

      userDetails.appendChild(userNameDiv);
      userDetails.appendChild(userHandle);

      // Actions
      const userActions = document.createElement('div');
      userActions.className = 'user-actions';

      const viewProfileLink = document.createElement('a');
      viewProfileLink.href = user.profileUrl || `https://x.com/${user.username}`;
      viewProfileLink.target = '_blank';
      viewProfileLink.title = 'View profile on X';
      viewProfileLink.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`; // External link icon

      userActions.appendChild(viewProfileLink);

      // Delete button only for 'queued' users
      if (user.status === 'queued') {
          const deleteButton = document.createElement('a');
          deleteButton.href = '#';
          deleteButton.className = 'delete-btn';
          deleteButton.title = 'Remove from queue';
           deleteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`; // Trash icon
          deleteButton.addEventListener('click', (event) => {
              event.preventDefault();
              removeUserFromList(user.username); // Only removes from extractedUsers
          });
          userActions.appendChild(deleteButton);
      }

      userItem.appendChild(userDetails);
      userItem.appendChild(userActions);

      return userItem;
  }

  // Updated: Show count based on filter/search
  function updateUserCount(displayedCount, totalFilteredByStatus) {
       if (searchInput.value.trim()) {
            userCountSpan.textContent = `Showing ${displayedCount} of ${totalFilteredByStatus} ${currentFilter} users`;
       } else {
            userCountSpan.textContent = `${displayedCount} ${currentFilter} users`;
       }
  }

  // --- Agent Control Handlers ---
   async function handleStartAgent() {
      setButtonLoading(startAgentBtn, true);
      setButtonLoading(stopAgentBtn, false); // Ensure stop is not loading
      stopAgentBtn.disabled = true; // Disable stop while starting

      try {
          showStatus('Initializing agent...', 'info');
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tabs || tabs.length === 0) throw new Error('No active tab found');
          const tab = tabs[0];
          if (!tab.url || (!tab.url.includes('twitter.com') && !tab.url.includes('x.com'))) {
              throw new Error('Please navigate to Twitter/X first');
          }

          const data = await chrome.storage.local.get(['agentSettings', 'extractedUsers', 'followedUsers']);
          const settings = data.agentSettings;
          const extractedUsers = data.extractedUsers || [];
          const followedUsers = data.followedUsers || [];

          if (!settings || (!settings.enableAutoFollow && !settings.enableAutoUnfollow)) {
               throw new Error('Please enable auto-follow or auto-unfollow in settings');
          }
          // Check if follow is enabled and queue is empty (only check if UNFOLLOW is disabled)
          if (settings.enableAutoFollow && !settings.enableAutoUnfollow && extractedUsers.length === 0) {
               throw new Error('No users in queue to follow. Extract users first.');
          }

          await ensureContentScriptInjected(tab.id);
          await new Promise(resolve => setTimeout(resolve, 200)); // Small delay

          showStatus('Starting agent...', 'info');
          const result = await chrome.runtime.sendMessage({ action: 'startFollowAgent' });

          if (!result || !result.success) {
              throw new Error(result?.error || 'Failed to start agent');
          }

          showStatus(`Agent started: ${result.message || 'Processing'}`, 'success');
          await updateAgentStatus(); // Update UI immediately
      
    } catch (error) {
      console.error('Error starting agent:', error);
          showStatus(`Start Error: ${error.message}`, 'error');
          await updateAgentStatus(); // Ensure UI reflects agent didn't start
      } finally {
          setButtonLoading(startAgentBtn, false);
          // Re-enable buttons based on actual status after potential errors
          await updateAgentStatus();
    }
  }
  
  async function handleStopAgent() {
      setButtonLoading(stopAgentBtn, true);
      setButtonLoading(startAgentBtn, false); // Ensure start is not loading
      startAgentBtn.disabled = true; // Disable start while stopping

    try {
          showStatus('Stopping agent...', 'info');
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tabs || tabs.length === 0) throw new Error('No active tab found');
      const tab = tabs[0];
      
          // No need to check URL here, stopping should always be possible if agent is running

          await ensureContentScriptInjected(tab.id); // Ensure scripts are there to receive message
          await new Promise(resolve => setTimeout(resolve, 200)); // Small delay

          const result = await chrome.runtime.sendMessage({ action: 'stopFollowAgent' });

          if (!result || !result.success) {
              // Attempt to force stop via storage if message fails
              console.warn("Stopping agent via message failed, attempting storage update.");
              await forceStopAgentState();
               throw new Error(result?.error || 'Failed to stop agent via message');
          }

          showStatus(`Agent stopped: ${result.message || 'Stopped'}`, 'success');
          await updateAgentStatus(); // Update UI immediately
      
    } catch (error) {
      console.error('Error stopping agent:', error);
          showStatus(`Stop Error: ${error.message}`, 'error');
          await forceStopAgentState(); // Ensure state is stopped even on error
          await updateAgentStatus(); // Update UI to reflect stop
      } finally {
           setButtonLoading(stopAgentBtn, false);
           // Re-enable buttons based on actual status
           await updateAgentStatus();
      }
  }

   // Force stop agent state in storage (fallback)
   async function forceStopAgentState() {
      try {
        const data = await chrome.storage.local.get('agentState');
            let currentState = data.agentState || {};
            if (currentState.isRunning) {
                 currentState.isRunning = false;
                 currentState.currentUser = null;
                 await chrome.storage.local.set({ agentState: currentState });
                 console.log("Forced agent state to stopped in storage.");
            }
        } catch(e) {
             console.error("Error forcing agent stop state:", e);
        }
   }

  // Helper to set button loading state
  function setButtonLoading(button, isLoading) {
      if (!button) return;
      if (isLoading) {
          button.classList.add('loading');
          button.disabled = true;
      } else {
          button.classList.remove('loading');
          // Re-enablement is handled by updateAgentStatus
      }
  }

  // --- User List Management ---
  async function handleClearQueue() {
      // Confirmation dialog
      console.log('[handleClearQueue] Button clicked');
      // Removed confirmation dialog as it wasn't appearing for the user.
      // WARNING: Clicking the button will now immediately clear the queue.

      try {
          console.log('[handleClearQueue] Attempting to clear extractedUsers in storage...');
          // Simply clear the entire extractedUsers list
          await chrome.storage.local.set({ extractedUsers: [] });
          console.log('[handleClearQueue] Storage set call completed.');
          
          showStatus('Queued users cleared successfully', 'success');
          await loadAndDisplayUsers(); // Reload and display updated list
      } catch (error) {
          console.error('Error clearing queue:', error);
          showStatus(`Error clearing queue: ${error.message}`, 'error');
      }
  }

   // Only removes from extractedUsers list (used for 'Queued' status)
  async function removeUserFromList(username) {
      try {
          const data = await chrome.storage.local.get('extractedUsers');
          const currentUsers = data.extractedUsers || [];
          const updatedUsers = currentUsers.filter(user => user.username !== username);

          await chrome.storage.local.set({ extractedUsers: updatedUsers });
         // Don't show status message for individual delete, it's disruptive
         // showStatus(`User @${username} removed from queue`, 'success');
          await loadAndDisplayUsers(); // Reload and redisplay
      } catch (error) {
          console.error('Error removing user:', error);
          showStatus(`Error removing user: ${error.message}`, 'error');
      }
  }

  // --- Other Handlers ---
  async function handleExtractUsernames() {
    setButtonLoading(extractUsernamesBtn, true);
    try {
      showStatus('Extracting usernames...', 'info');
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) throw new Error('No active tab found');
      const tab = tabs[0];
      if (!tab.url || (!tab.url.includes('twitter.com') && !tab.url.includes('x.com'))) {
        throw new Error('Please navigate to a Twitter/X followers or following page');
      }

      await ensureContentScriptInjected(tab.id);
      
      let maxScrolls = 50;
      for (const option of scrollOptions) {
        if (option.checked) {
          maxScrolls = parseInt(option.value);
          break;
        }
      }
      
      const result = await chrome.tabs.sendMessage(tab.id, { 
        action: 'extractUsernames',
        options: { maxScrolls }
      });
      
      if (!result || !result.success) {
        throw new Error(result?.error || 'Extraction failed in content script');
      }
      
      showStatus(`Successfully extracted ${result.usernames.length} new usernames`, 'success');
      await loadAndDisplayUsers();
      
    } catch (error) {
      console.error('Error extracting usernames:', error);
      showStatus(`Extraction Error: ${error.message}`, 'error');
    } finally {
         setButtonLoading(extractUsernamesBtn, false);
    }
  }

  // <<< UPDATED: Handler for List URL Extraction >>>
  async function handleExtractFromListUrl() {
      const listUrl = listUrlInput.value.trim();
      setButtonLoading(extractFromListUrlBtn, true);

      try {
          // Validate URL
          if (!listUrl) {
              throw new Error('Please enter a list URL');
          }
          const urlPattern = /^https:\/\/(x|twitter)\.com\/i\/lists\/\d+\/members$/;
          if (!urlPattern.test(listUrl)) {
              throw new Error('Invalid list members URL format. Use e.g., https://x.com/i/lists/123.../members');
          }

          showStatus(`Navigating current tab to list ${listUrl}...`, 'info');

          // Get the current active tab
          const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!currentTab || !currentTab.id) {
               throw new Error('Could not find active tab.');
          }
          const activeTabId = currentTab.id;

          // Update the current tab's URL
          await chrome.tabs.update(activeTabId, { url: listUrl });

          showStatus('Waiting for list page navigation...', 'info');

          // Wait for the tab to finish navigating and loading
          await new Promise((resolve, reject) => {
              const listener = (tabId, changeInfo, tab) => {
                  // Ensure we are listening only for the correct tab and it's fully loaded
                  if (tabId === activeTabId && changeInfo.status === 'complete' && tab.url === listUrl) {
                      chrome.tabs.onUpdated.removeListener(listener); // Clean up listener
                      console.log(`Tab ${activeTabId} finished loading URL: ${listUrl}`);
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

          // Wait a bit longer for dynamic content (modal/list population)
          const waitTime = 5000; // 5 seconds, adjust if needed
          showStatus(`Navigation complete. Waiting ${waitTime / 1000}s for members to load...`, 'info');
          await new Promise(resolve => setTimeout(resolve, waitTime));

          showStatus('Injecting scripts and extracting...', 'info');
          await ensureContentScriptInjected(activeTabId); // Ensure scripts are ready in the navigated tab

          // Send extraction message to the *same* active tab (using default scrolls)
          const result = await chrome.tabs.sendMessage(activeTabId, {
              action: 'extractUsernames',
              options: { maxScrolls: 50 } // Use a default scroll count for lists
          });

          if (!result || !result.success) {
              throw new Error(result?.error || 'Extraction failed in list tab');
          }

          showStatus(`Successfully extracted ${result.usernames.length} new usernames from list`, 'success');
          await loadAndDisplayUsers(); // Refresh the popup list
      
    } catch (error) {
          console.error('Error extracting from list URL:', error);
          showStatus(`List Extraction Error: ${error.message}`, 'error');
      } finally {
          setButtonLoading(extractFromListUrlBtn, false);
      }
  }

  // <<< NEW: Handler for Community URL Extraction >>>
  async function handleExtractFromCommunityUrl() {
      const communityUrl = communityUrlInput.value.trim();
      setButtonLoading(extractFromCommunityUrlBtn, true);

      try {
          // Validate URL
          if (!communityUrl) {
              throw new Error('Please enter a community members URL');
          }
          // Updated regex to be slightly more flexible with potential query params
          const urlPattern = /^https:\/\/(x|twitter)\.com\/i\/communities\/\d+\/members(?:\?.*)?$/;
          if (!urlPattern.test(communityUrl)) {
              throw new Error('Invalid community members URL format. Use e.g., https://x.com/i/communities/123.../members');
          }

          showStatus(`Navigating current tab to community ${communityUrl}...`, 'info');

          // Get the current active tab
          const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!currentTab || !currentTab.id) {
               throw new Error('Could not find active tab.');
          }
          const activeTabId = currentTab.id;

          // Update the current tab's URL
          await chrome.tabs.update(activeTabId, { url: communityUrl });

          showStatus('Waiting for community members page navigation...', 'info');

          // Wait for the tab to finish navigating and loading
          await new Promise((resolve, reject) => {
              const listener = (tabId, changeInfo, tab) => {
                  // Ensure we are listening only for the correct tab and it's fully loaded
                  if (tabId === activeTabId && changeInfo.status === 'complete' && tab.url && tab.url.startsWith(communityUrl.split('?')[0])) { // Check base URL match
                      chrome.tabs.onUpdated.removeListener(listener); // Clean up listener
                      console.log(`Tab ${activeTabId} finished loading URL matching: ${communityUrl}`);
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

          // Wait a bit longer for dynamic content 
          const waitTime = 3000; // 3 seconds, adjust if needed (community pages might load faster than list modals)
          showStatus(`Navigation complete. Waiting ${waitTime / 1000}s for members to load...`, 'info');
          await new Promise(resolve => setTimeout(resolve, waitTime));

          showStatus('Injecting scripts and extracting community members...', 'info');
          await ensureContentScriptInjected(activeTabId); // Ensure scripts are ready in the navigated tab

          // Send extraction message to the *same* active tab (using default scrolls)
          const result = await chrome.tabs.sendMessage(activeTabId, {
              action: 'extractUsernames',
              options: { maxScrolls: 50 } // Use a default scroll count
          });

          if (!result || !result.success) {
              throw new Error(result?.error || 'Extraction failed in community tab');
          }

          showStatus(`Successfully extracted ${result.usernames.length} new usernames from community`, 'success');
          await loadAndDisplayUsers(); // Refresh the popup list

      } catch (error) {
          console.error('Error extracting from community URL:', error);
          showStatus(`Community Extraction Error: ${error.message}`, 'error');
      } finally {
          setButtonLoading(extractFromCommunityUrlBtn, false);
      }
  }

  async function handleDebug() {
     setButtonLoading(debugBtn, true);
     debugInstructions.classList.add('hidden'); // Hide instructions initially
     try {
         showStatus('Initializing debug interface...', 'warning');
         const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
         if (!tabs || tabs.length === 0) throw new Error('No active tab found');
         const tab = tabs[0];
          if (!tab.url || (!tab.url.includes('twitter.com') && !tab.url.includes('x.com'))) {
             throw new Error('Please navigate to Twitter/X first');
         }

         await ensureContentScriptInjected(tab.id);

         await chrome.tabs.sendMessage(tab.id, { action: 'showDebugUI' });
         showStatus('Debug UI activated. Check Twitter page (bottom-left).', 'success');
         debugInstructions.classList.remove('hidden'); // Show instructions
         switchTab('agent'); // Switch to agent tab where instructions are

     } catch (error) {
         console.error('Debug error:', error);
         showStatus(`Debug Error: ${error.message}`, 'error');
         debugInstructions.classList.remove('hidden'); // Show instructions even on error
         switchTab('agent');
     } finally {
         setButtonLoading(debugBtn, false);
     }
  }


  async function updateAgentStatus() {
      // Added checks for element existence before updating
      const agentStatusIndicator = document.getElementById('agent-status-indicator');
      const statusText = agentStatusIndicator ? agentStatusIndicator.querySelector('.status-text') : null;
      const currentAction = document.getElementById('current-action');
      const dailyFollowCount = document.getElementById('daily-follow-count');
      const dailyUnfollowCount = document.getElementById('daily-unfollow-count');
      const totalFollowCount = document.getElementById('total-follow-count');
      const followLimit = document.getElementById('follow-limit');
      const startAgentBtn = document.getElementById('start-agent');
      const stopAgentBtn = document.getElementById('stop-agent');

      if (!agentStatusIndicator || !statusText || !currentAction || !dailyFollowCount || !dailyUnfollowCount || !totalFollowCount || !followLimit || !startAgentBtn || !stopAgentBtn) {
          console.warn("updateAgentStatus called, but some required UI elements were not found.");
          return; // Exit if essential elements are missing
      }

       try {
          const data = await chrome.storage.local.get(['agentSettings', 'agentState', 'followedUsers']);
          const settings = data.agentSettings;
          const agentState = data.agentState || { isRunning: false, dailyStats: { followCount: 0, unfollowCount: 0 }, errors: [] };
          agentState.dailyStats = agentState.dailyStats || { followCount: 0, unfollowCount: 0 };
          const followedUsers = data.followedUsers || [];

          let isRunning = agentState.isRunning || false;
          let statusClass = 'offline';
          let statusLabel = 'Agent Offline';
          let actionText = 'Idle';

          if (isRunning) {
              statusClass = 'online';
              statusLabel = 'Agent Running';
              actionText = agentState.currentUser ? `Processing @${agentState.currentUser}` : 'Waiting...';
              startAgentBtn.disabled = true;
              stopAgentBtn.disabled = false;
        } else {
              startAgentBtn.disabled = false;
              stopAgentBtn.disabled = true;
              if (agentState.errors && agentState.errors.length > 0) {
                  statusClass = 'error';
                  statusLabel = 'Agent Error';
                  actionText = agentState.errors[agentState.errors.length - 1].error;
              }
          }

          agentStatusIndicator.className = `status-indicator ${statusClass}`;
          statusText.textContent = statusLabel;
          currentAction.textContent = actionText;

          dailyFollowCount.textContent = agentState.dailyStats?.followCount || 0;
          dailyUnfollowCount.textContent = agentState.dailyStats?.unfollowCount || 0;
          totalFollowCount.textContent = followedUsers.filter(u => !u.unfollowedAt).length;
          followLimit.textContent = settings?.dailyFollowLimit || 'N/A';

    } catch (error) {
          console.error('Error updating agent status:', error);
          // Potentially show an error in the agent tab status area
      }
  }

  // --- NEW: Display Metrics --- 
  async function displayMetrics() {
      // Added checks for element existence
       const metricElements = {
            f24h: document.getElementById('metric-follows-24h'),
            u24h: document.getElementById('metric-unfollows-24h'),
            n24h: document.getElementById('metric-net-24h'),
            f7d: document.getElementById('metric-follows-7d'),
            u7d: document.getElementById('metric-unfollows-7d'),
            n7d: document.getElementById('metric-net-7d'),
            f30d: document.getElementById('metric-follows-30d'),
            u30d: document.getElementById('metric-unfollows-30d'),
            n30d: document.getElementById('metric-net-30d'),
            fAll: document.getElementById('metric-follows-all'),
            uAll: document.getElementById('metric-unfollows-all'),
            // Add placeholders if needed
       };
       // Check if at least one metric element is missing
       if (Object.values(metricElements).some(el => !el)) {
            console.warn("displayMetrics called, but some metric UI elements were not found.");
            return;
       }

    try {
      const data = await chrome.storage.local.get(['followedUsers', 'agentState']); // Agent state has daily counts
      const followedUsers = data.followedUsers || [];
      const agentState = data.agentState || { dailyStats: { date: null, followCount: 0, unfollowCount: 0 } }; 
      agentState.dailyStats = agentState.dailyStats || { followCount: 0, unfollowCount: 0 };

      // --- Calculate Metrics ---
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);

      // All Time
      const totalFollowsAll = followedUsers.length;
      const totalUnfollowsAll = followedUsers.filter(u => u.unfollowedAt).length;
      // Follow-back rate and avg unfollow time require more data tracking

      // 24 Hours (using dailyStats from agentState)
      let follows24h = 0;
      let unfollows24h = 0;
      if (agentState.dailyStats.date === todayStr) {
          follows24h = agentState.dailyStats.followCount || 0;
          unfollows24h = agentState.dailyStats.unfollowCount || 0;
      }
       // We can't accurately calculate 7d/30d without historical daily data yet

      // --- Update HTML Elements --- (using the elements object)
      metricElements.f24h.textContent = follows24h;
      metricElements.u24h.textContent = unfollows24h;
      metricElements.n24h.textContent = follows24h - unfollows24h;
      
      // 7d - Placeholders 
      metricElements.f7d.textContent = '0'; 
      metricElements.u7d.textContent = '0'; 
      metricElements.n7d.textContent = '0'; 

      // 30d - Placeholders 
      metricElements.f30d.textContent = '0'; 
      metricElements.u30d.textContent = '0'; 
      metricElements.n30d.textContent = '0'; 

      // All Time
      metricElements.fAll.textContent = totalFollowsAll;
      metricElements.uAll.textContent = totalUnfollowsAll;

    } catch (error) {
      console.error('Error displaying metrics:', error);
      showStatus(`Error loading metrics: ${error.message}`, 'error');
    }
  }

  // --- Utility Functions ---
  function showStatus(message, type) {
    statusMessage.textContent = message;
      statusMessage.className = `status ${type}`; // Ensure class includes 'status'
    statusMessage.classList.remove('hidden');
    
      // Auto-hide non-error messages after 4 seconds
      if (type !== 'error') {
      setTimeout(() => {
        statusMessage.classList.add('hidden');
          }, 4000);
      }
  }

  async function ensureContentScriptInjected(tabId) {
      // Simplified check - assuming background script handles injection reliably now
      try {
          await chrome.tabs.sendMessage(tabId, { action: 'ping' });
          return true;
      } catch (error) {
           console.log('Content script ping failed, attempting injection via background...', error);
           try {
                // Ask background script to ensure injection
                const response = await chrome.runtime.sendMessage({ action: 'injectContentScript', tabId: tabId });
                if (!response || !response.success) {
                    throw new Error(response?.error || 'Background script failed to inject');
                }
                await new Promise(resolve => setTimeout(resolve, 300)); // Give scripts time to load
                return true;
           } catch(bgError) {
                console.error('ensureContentScriptInjected error:', bgError);
                throw new Error('Could not ensure content scripts are loaded: ' + bgError.message);
           }
    }
  }

  function exportUsersToCsv() {
      // Uses the combined allUsersData list
      if (allUsersData.length === 0) {
          showStatus('No users to export', 'warning');
        return;
      }
      try {
          let csvContent = 'Username,Display Name,Profile URL,Status,Extracted At,Followed At,Unfollowed At\n';
          allUsersData.forEach(user => {
        const userName = user.username || '';
              const displayName = `"${(user.displayName || '').replace(/"/g, '""')}"`; // Escape quotes
        const profileUrl = user.profileUrl || `https://x.com/${userName}`;
              const status = user.status || '';
        const extractedAt = user.extractedAt || '';
              const followedAt = user.followedAt || '';
              const unfollowedAt = user.unfollowedAt || '';
              csvContent += `${userName},${displayName},${profileUrl},${status},${extractedAt},${followedAt},${unfollowedAt}\n`;
      });
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
          link.setAttribute('download', `x_growth_users_${new Date().toISOString().slice(0, 10)}.csv`);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showStatus('Users exported successfully', 'success');
    } catch (error) {
      console.error('Error exporting users:', error);
          showStatus(`Export Error: ${error.message}`, 'error');
    }
  }

  // <<< NEW: Test Functions >>>
  function handleRunTest() {
    if (!testUsernameInput || !testDelayInput || !testDelayUnitSelect || !runTestBtn || !testStatusLog || !testResultsLog) {
        console.error("Test UI elements not found.");
        showTestError("Internal error: UI elements missing.");
        return;
    }

    const username = testUsernameInput.value.trim();
    const delayValue = parseInt(testDelayInput.value, 10);
    const delayUnit = testDelayUnitSelect.value;

    // --- Validation ---
    if (!username) {
        showTestError("Please enter a Twitter username.");
        return;
    }
    if (!username.startsWith('@')) {
        showTestError("Username must start with '@'.");
        return;
    }
    if (isNaN(delayValue) || delayValue <= 0) {
        showTestError("Please enter a valid positive delay number.");
        return;
    }

    hideTestError(); // Clear previous errors
    testStatusLog.textContent = ''; // Clear logs
    testResultsLog.textContent = '';

    // --- Calculate Delay ---
    let delayMs = 0;
    if (delayUnit === 'seconds') {
        delayMs = delayValue * 1000;
    } else if (delayUnit === 'minutes') {
        delayMs = delayValue * 60 * 1000;
    } else {
        showTestError("Invalid delay unit selected.");
        return;
    }

    // --- Send to Background ---
    console.log(`Running test for ${username} with delay ${delayMs}ms`);
    appendLog(testStatusLog, `Starting test for ${username}...`);
    runTestBtn.disabled = true;
    runTestBtn.textContent = 'Running...';

    chrome.runtime.sendMessage({
        action: 'runFollowTest',
        username: username,
        delayMs: delayMs
    }, (response) => {
         if (chrome.runtime.lastError) {
            console.error("Error sending test message to background:", chrome.runtime.lastError.message);
            showTestError(`Error starting test: ${chrome.runtime.lastError.message}`);
            runTestBtn.disabled = false;
            runTestBtn.textContent = 'Run Test';
        } else if (response && response.status === 'error') {
            console.error("Background script reported error on start:", response.message);
            showTestError(`Background error: ${response.message}`);
            runTestBtn.disabled = false;
            runTestBtn.textContent = 'Run Test';
        } else {
            console.log("Test message sent to background successfully.");
            // Button will be re-enabled by message listener on completion/error
        }
    });
  }

  function appendLog(logElement, message) {
      if (!logElement) return;
      const timestamp = new Date().toLocaleTimeString();
      logElement.textContent += `[${timestamp}] ${message}\\n`;
      logElement.scrollTop = logElement.scrollHeight; // Auto-scroll
  }

  function showTestError(message) {
      if (!testErrorMessage) return;
      testErrorMessage.textContent = message;
      testErrorMessage.classList.remove('hidden');
  }

  function hideTestError() {
       if (!testErrorMessage) return;
       testErrorMessage.classList.add('hidden');
       testErrorMessage.textContent = '';
  }
  // <<< END NEW >>>

  // <<< NEW: Settings Functions >>>
  async function loadSettings() {
    try {
      const data = await chrome.storage.local.get('agentSettings');
      const settings = data.agentSettings || {};
      console.log('Loading settings into form:', settings);

      // Populate simple number inputs
      document.getElementById('dailyFollowLimit').value = settings.dailyFollowLimit ?? 50;
      document.getElementById('hourlyFollowLimit').value = settings.hourlyFollowLimit ?? 0;
      document.getElementById('maxActionsSession').value = settings.maxActionsSession ?? 0;
      document.getElementById('followInterval').value = settings.followInterval ?? 60;
      document.getElementById('timeVariance').value = settings.timeVariance ?? 20;
      document.getElementById('unfollowDays').value = settings.unfollowDays ?? 3;
      document.getElementById('unfollowSeconds').value = settings.unfollowSeconds ?? 0;
      document.getElementById('minThinkingTime').value = settings.minThinkingTime ?? 250;
      document.getElementById('maxThinkingTime').value = settings.maxThinkingTime ?? 1250;

      // Populate checkboxes
      document.getElementById('enableAutoFollow').checked = settings.enableAutoFollow ?? true; // Default true based on background.js
      document.getElementById('enableAutoUnfollow').checked = settings.enableAutoUnfollow ?? true; // Default true based on background.js

    } catch (error) {
      console.error('Error loading settings:', error);
      showSettingsStatus(`Error loading settings: ${error.message}`, 'error');
    }
  }

  async function saveSettings(event) {
    if (event) event.preventDefault(); // Prevent default form submission
    
    const saveButton = document.getElementById('save-settings-btn');
    setButtonLoading(saveButton, true);
    showSettingsStatus('Saving...', 'info');

    try {
      const newSettings = {
        dailyFollowLimit: parseInt(document.getElementById('dailyFollowLimit').value, 10) || 50,
        hourlyFollowLimit: parseInt(document.getElementById('hourlyFollowLimit').value, 10) || 0,
        maxActionsSession: parseInt(document.getElementById('maxActionsSession').value, 10) || 0,
        followInterval: parseInt(document.getElementById('followInterval').value, 10) || 60,
        timeVariance: parseInt(document.getElementById('timeVariance').value, 10) || 20,
        unfollowDays: parseInt(document.getElementById('unfollowDays').value, 10) || 3,
        unfollowSeconds: parseInt(document.getElementById('unfollowSeconds').value, 10) || 0,
        minThinkingTime: parseInt(document.getElementById('minThinkingTime').value, 10) || 250,
        maxThinkingTime: parseInt(document.getElementById('maxThinkingTime').value, 10) || 1250,
        enableAutoFollow: document.getElementById('enableAutoFollow').checked,
        enableAutoUnfollow: document.getElementById('enableAutoUnfollow').checked,
        lastUpdated: new Date().toISOString()
      };

      // Validation (simple example)
      if (newSettings.followInterval < 1) newSettings.followInterval = 1;
      if (newSettings.timeVariance < 0 || newSettings.timeVariance > 100) newSettings.timeVariance = 20;
      if (newSettings.unfollowSeconds < 0) newSettings.unfollowSeconds = 0;
      if (newSettings.minThinkingTime < 0) newSettings.minThinkingTime = 0;
      if (newSettings.maxThinkingTime < newSettings.minThinkingTime) newSettings.maxThinkingTime = newSettings.minThinkingTime + 500;

      console.log('Saving settings:', newSettings);
      await chrome.storage.local.set({ agentSettings: newSettings });
      showSettingsStatus('Settings saved successfully!', 'success');

    } catch (error) {
      console.error('Error saving settings:', error);
      showSettingsStatus(`Error saving settings: ${error.message}`, 'error');
    } finally {
      setButtonLoading(saveButton, false);
    }
  }

  // Helper to show status specifically in the settings tab
  function showSettingsStatus(message, type) {
    const settingsStatus = document.getElementById('settings-status');
    if (settingsStatus) {
      settingsStatus.textContent = message;
      settingsStatus.className = `status ${type}`; // Ensure class includes 'status'
      settingsStatus.classList.remove('hidden');

      // Auto-hide non-error messages after 3 seconds
      if (type !== 'error') {
        setTimeout(() => {
          settingsStatus.classList.add('hidden');
        }, 3000);
      }
    } else {
      // Fallback to general status message if settings one isn't found (shouldn't happen)
      showStatus(message, type);
    }
  }
  // <<< END NEW >>>
}); 
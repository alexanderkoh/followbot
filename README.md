# X Growth Agent

A Chrome extension for extracting and managing Twitter/X usernames to grow your follower base.

## Features

- Extract usernames from Twitter/X followers and following pages
- Auto-scrolling to load more users
- Storage of extracted usernames for later use
- Clean and intuitive user interface

## Installation

### Development Mode

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the extension directory
5. The extension icon should appear in your browser toolbar

### Usage

1. Navigate to a Twitter/X profile's followers or following page (e.g., `https://twitter.com/elonmusk/followers`)
2. Click the extension icon to open the popup
3. Click "Extract Usernames" to start the extraction process
4. The extension will auto-scroll the page to load more users
5. Extracted usernames will be stored for later use
6. Use "Clear Queue" to reset the stored usernames

## Technical Details

- Built with vanilla JavaScript
- Uses Chrome Extension Manifest V3
- Stores data in chrome.storage.local

## Future Enhancements

## Future Improvements

The following features are planned for future releases. Each item includes a detailed prompt that can be used with Cursor IDE or similar AI coding assistants to implement the feature.

### 1. Timer Display for Follow Agent

**TODO:** Add a visual timer showing elapsed time since agent start and countdown to follow-back checks.

**Cursor Prompt:**
Add a timer display to the X Growth Agent that shows:
How long the agent has been running (elapsed time)
Countdown to when the app will check if users followed back
If they didn't follow back, when they'll be unfollowed
Implementation details:
Create a new component in the popup UI that displays these timers
Update the timer every second using setInterval
Format time as "00h 00m 00s" for readability
Store the agent start time in chrome.storage.local
Calculate the follow-back check time based on settings
Add visual indicators (green/yellow/red) for different time states
Ensure the timer persists across popup reopens


### 2. Improved Time Windows for Unfollowing

**TODO:** Enhance time settings with flexible units (Days, Hours, Minutes, Seconds).

**Cursor Prompt:**
Enhance the unfollow time settings in the X Growth Agent by:
Adding a dropdown to select time units (Days, Hours, Minutes, Seconds)
Allowing users to input a numeric value for that time unit
Improving the UI for time-related settings
Implementation details:
Update the settings UI in popup/settings.html to include a dropdown for time units
Add validation to ensure reasonable values (e.g., 1-30 days, 1-24 hours)
Store the selected unit and value separately in the settings object
Update the settings save/load functions to handle the new format
Convert all time calculations to use the new format
Add tooltips explaining recommended values for each time unit
Ensure backward compatibility with existing settings


### 3. Test Flow for Quick Verification

**TODO:** Create a test tab for quick verification of follow/unfollow functionality.

**Cursor Prompt:**
Create a test tab in the X Growth Agent extension that allows:
1. Input of a specific Twitter/X username to follow
Setting a short timeframe for follow-back checking (seconds/minutes)
Automatic follow, wait, check, and unfollow process for testing
Implementation details:
Add a new "Test" tab to the popup UI
Create a form with username input and time input (with unit selection)
Add a "Run Test" button that initiates the test flow
Create a dedicated test flow function in the background script
Show real-time progress of the test with status updates
Log each step of the process for debugging
Add a "Test Results" section showing success/failure of each step
Ensure the test doesn't interfere with the main agent functionality


### 4. Improved User Extraction

**TODO:** Fix user extraction to capture all visible users with gradual scrolling.

**Cursor Prompt:**
Fix and improve the user extraction functionality in X Growth Agent to:
Extract ALL visible users from followers/following pages
Implement gradual, controlled scrolling to load all users
Provide visual feedback during the extraction process
Implementation details:
Rewrite the scrolling mechanism to use smaller, more controlled steps
Add pause intervals between scrolls to allow content to load
Implement multiple selector patterns to catch all user elements
Add a visual counter showing extracted users in real-time
Implement detection for when scrolling reaches the bottom
Add retry logic for failed extractions
Improve error handling and reporting
Add an option to limit the maximum number of users to extract
Ensure compatibility with both twitter.com and x.com domains

## Implementation Strategy

To implement these improvements effectively:

1. **Start with the user extraction fix** as it's the foundation of the extension's functionality
2. **Implement the time window improvements** next to enhance the core follow/unfollow logic
3. **Add the test flow** to make it easier to verify the other improvements
4. **Finally, add the timer display** to provide better visibility into the agent's operation

Each feature should be implemented and tested independently to avoid introducing new bugs. The prompts provided are designed to be comprehensive enough for an AI assistant to generate working code, but may need adjustments based on the specific implementation details of your codebase.

## License

MIT

## Disclaimer

This extension is for educational purposes only. Please use responsibly and in accordance with Twitter/X's terms of service. 
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

- Follow functionality: Add buttons to follow extracted users
- Unfollow functionality: Track followed users and unfollow those who don't follow back
- Analytics dashboard: Track follow-back rates and other metrics
- Settings: Add configurable options for follow/unfollow behavior

## License

MIT

## Disclaimer

This extension is for educational purposes only. Please use responsibly and in accordance with Twitter/X's terms of service. 
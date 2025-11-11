// This script runs in the top-level frame and acts as a coordinator.

if (window.self === window.top) {
  console.log('Overdrive CBZ Exporter: Top-level content script injected.');

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // This listener can be from the popup or the iframe.

    // Case 1: Message is from the popup (sender.tab is undefined)
    if (sender.tab === undefined) {
        if (request.action === 'isContentScriptReady') {
            sendResponse({ status: 'ready' });
        }
        // Relay capturePage message from popup to the active tab's iframe
        else if (request.action === 'capturePage') {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0) {
                    chrome.tabs.sendMessage(tabs[0].id, request, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error('Error relaying message to iframe:', chrome.runtime.lastError.message);
                            sendResponse({ error: 'Could not communicate with the book content.' });
                        } else {
                            sendResponse(response);
                        }
                    });
                }
            });
            return true; // Keep channel open for async response
        }
        return;
    }

    // Case 2: Message is from another content script (e.g., iframe)
    if (request.action === 'scanForTitle') {
      console.log('Top-level script: Scanning for book title...');
      const title = findBookTitle();
      sendResponse({ title });
      return;
    }

    // Relay scanForPages from popup to all frames in the tab
    if (request.action === 'scanForPages') {
      console.log(`Top-level script: Relaying action "${request.action}" to iframe.`);
      chrome.tabs.sendMessage(sender.tab.id, request, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error relaying message to iframe:', chrome.runtime.lastError.message);
          sendResponse({ error: 'Could not communicate with the book content. Is the book open?' });
        } else {
          sendResponse(response);
        }
      });
      return true; // Keep the message channel open for the async response.
    }
  });
}

function findBookTitle() {
  const titleElement = document.querySelector('h1.title-text') || document.querySelector('h1');
  if (titleElement) {
    // Sanitize title to remove characters that are invalid in filenames
    return titleElement.innerText.trim().replace(/[^a-zA-Z0-9 ]/g, '');
  }
  return '';
}

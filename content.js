// This script runs in the top-level frame and acts as a coordinator.

if (window.self === window.top) {

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!sender.tab) {
      return;
    }

    if (request.action === 'scanForTitle') {
      console.log('Top-level script: Scanning for book title...');
      const title = findBookTitle();
      sendResponse({ title });
      return;
    }

    if (request.action === 'scanForPages' || request.action === 'capturePage') {
      console.log(`Top-level script: Relaying action "${request.action}" to iframe.`);
      // We send the message to the tab, and the iframe_script will be the one to respond.
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
    return titleElement.innerText.trim().replace(/[^a-zA-Z0-9 ]/g, '');
  }
  return '';
}

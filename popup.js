document.addEventListener('DOMContentLoaded', () => {
  const scanButton = document.getElementById('scan-pages');
  const detectedPagesContainer = document.getElementById('detected-pages');
  const previewsContainer = document.getElementById('previews');
  const pageCountSpan = document.getElementById('page-count');
  const titleInput = document.getElementById('book-title');
  const createCbzButton = document.getElementById('create-cbz');
  const clearSessionButton = document.getElementById('clear-session');

  // On startup, check if the content script is ready.
  checkContentScriptReady();

  function checkContentScriptReady() {
    sendMessageToContentScript({ action: 'isContentScriptReady' }, (response) => {
      if (response && response.status === 'ready') {
        console.log('Content script is ready.');
        // Once ready, load the session and enable UI.
        loadSession().then(scanForTitle);
        scanButton.disabled = false;
        titleInput.disabled = false;
      } else {
        // If not ready, show a message and retry after a short delay.
        detectedPagesContainer.innerHTML = '<p>Waiting for page to load...</p>';
        scanButton.disabled = true;
        titleInput.disabled = true;
        setTimeout(checkContentScriptReady, 500);
      }
    });
  }

  scanButton.addEventListener('click', () => {
    sendMessageToContentScript({ action: 'scanForPages' }, (response) => {
      if (response && response.spreads) {
        renderDetectedPages(response.spreads);
      } else {
        detectedPagesContainer.innerHTML = '<p>No pages found on the current spread.</p>';
      }
    });
  });

  createCbzButton.addEventListener('click', () => {
    const title = titleInput.value.trim() || 'Untitled Book';
    chrome.runtime.sendMessage({ action: 'createCbz', title: title }, (res) => {
        alert('CBZ creation started! Your download will begin shortly.');
    });
  });

  clearSessionButton.addEventListener('click', () => {
    chrome.storage.local.set({ screenshots: [], bookTitle: '' }, () => {
      loadSession();
      detectedPagesContainer.innerHTML = '';
      alert('Session cleared!');
    });
  });

  titleInput.addEventListener('input', () => {
      chrome.storage.local.set({ bookTitle: titleInput.value });
  });

  function scanForTitle() {
      // Only scan for title if it's not already set
      if (titleInput.value.trim() === '') {
          sendMessageToContentScript({ action: 'scanForTitle' }, (response) => {
              if (response && response.title) {
                  titleInput.value = response.title;
                  chrome.storage.local.set({ bookTitle: response.title });
              }
          });
      }
  }

  function renderDetectedPages(spreads) {
    detectedPagesContainer.innerHTML = '';
    if (spreads.length === 0) {
        detectedPagesContainer.innerHTML = '<p>No spread divs found.</p>';
        return;
    }

    const container = document.createElement('div');
    container.innerHTML = '<h3>Detected Pages:</h3>';

    spreads.forEach(spreadId => {
      const captureButton = document.createElement('button');
      captureButton.textContent = `Capture Page ${spreadId}`;
      captureButton.onclick = () => {
        captureButton.textContent = 'Capturing...';
        captureButton.disabled = true;
        sendMessageToContentScript({ action: 'capturePage', spreadId: spreadId }, (response) => {
          if (response && response.dataUrl) {
            chrome.storage.local.get('screenshots', (data) => {
                const screenshots = data.screenshots || [];
                screenshots.push(response.dataUrl);
                chrome.storage.local.set({ screenshots }, () => {
                    loadSession();
                    captureButton.textContent = 'Captured!';
                });
            });
          } else if (response && response.error) {
            alert(`Capture failed: ${response.error}`);
            captureButton.textContent = `Capture Page ${spreadId}`;
            captureButton.disabled = false;
          } else {
            alert('Capture failed due to an unknown error.');
            captureButton.textContent = `Capture Page ${spreadId}`;
            captureButton.disabled = false;
          }
        });
      };
      container.appendChild(captureButton);
    });
    detectedPagesContainer.appendChild(container);
  }

  function loadSession() {
      return new Promise(resolve => {
          chrome.storage.local.get(['screenshots', 'bookTitle'], (data) => {
              const screenshots = data.screenshots || [];
              const bookTitle = data.bookTitle || '';

              titleInput.value = bookTitle;
              renderPreviews(screenshots);
              resolve();
          });
      });
  }

  function renderPreviews(screenshots) {
    previewsContainer.innerHTML = '';
    pageCountSpan.textContent = screenshots.length;

    if (screenshots.length === 0) {
      previewsContainer.innerHTML = '<p>No pages captured yet.</p>';
      return;
    }

    screenshots.forEach((dataUrl, index) => {
      const item = document.createElement('div');
      item.className = 'preview-item';

      const img = document.createElement('img');
      img.src = dataUrl;

      const label = document.createElement('p');
      label.textContent = `Page ${index + 1}`;

      item.appendChild(img);
      item.appendChild(label);
      previewsContainer.appendChild(item);
    });
  }

  function sendMessageToContentScript(message, callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
            chrome.tabs.sendMessage(tabs[0].id, message, callback);
        } else {
            console.error("Could not find active tab.");
        }
    });
  }
});

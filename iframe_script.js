// This script runs inside the Overdrive book iframe.

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Ensure the message is from our own extension and not from the page itself.
  if (sender.id !== chrome.runtime.id) {
    return;
  }

  // This script should only run in an iframe, so window.top will be different.
  if (window.self === window.top) {
      return;
  }

  if (request.action === 'scanForPages') {
    console.log('Iframe script: Scanning for page spreads...');
    const spreads = findSpreadDivs();
    sendResponse({ spreads: spreads.map(s => s.id) });
    return true; // Indicate async response
  }

  if (request.action === 'capturePage') {
    console.log(`Iframe script: Capturing page spread: ${request.spreadId}`);
    captureSpread(request.spreadId).then(response => {
      // response will be { dataUrl: ... } on success or { error: ... } on failure
      sendResponse(response);
    });
    return true; // Indicate async response
  }
});

function findSpreadDivs() {
  const spreadDivs = document.querySelectorAll('div[id^="spread_"]');
  return Array.from(spreadDivs);
}

async function captureSpread(spreadId) {
  const spreadDiv = document.getElementById(spreadId);

  if (!spreadDiv) {
    const errorMsg = `Could not find spread div with ID: ${spreadId}`;
    console.error(`Iframe script: ${errorMsg}`);
    return { error: errorMsg };
  }

  // Highlight the div to give user feedback
  const originalBorderStyle = spreadDiv.style.border;
  spreadDiv.style.border = '3px solid red';

  // Remove the highlight after 2 seconds
  setTimeout(() => {
    spreadDiv.style.border = originalBorderStyle;
  }, 2000);

  try {
    const canvas = await html2canvas(spreadDiv, {
      allowTaint: true,
      useCORS: true,
      logging: true // Enable logging for debugging
    });
    return { dataUrl: canvas.toDataURL('image/jpeg') };
  } catch (error) {
    const errorMsg = `html2canvas failed: ${error.message}`;
    console.error(`Iframe script: ${errorMsg}`, error);
    // Restore border immediately on error
    spreadDiv.style.border = originalBorderStyle;
    return { error: errorMsg };
  }
}

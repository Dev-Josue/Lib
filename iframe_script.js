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
    captureSpread(request.spreadId).then(dataUrl => {
      sendResponse({ dataUrl });
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
    console.error(`Iframe script: Could not find spread div with ID: ${spreadId}`);
    return null;
  }

  const canvas = await html2canvas(spreadDiv, {
    allowTaint: true,
    useCORS: true,
  });

  return canvas.toDataURL('image/jpeg');
}

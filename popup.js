document.addEventListener('DOMContentLoaded', () => {
  const startSavingButton = document.getElementById('start-saving');

  startSavingButton.addEventListener('click', () => {
    // Clear any previous screenshots before starting a new session
    chrome.runtime.sendMessage({ action: 'clearScreenshots' }, (response) => {
      console.log('Clearing screenshots:', response);
      // Once cleared, start the saving process in the active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'startSaving' });
      });
    });
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startSaving') {
    console.log('Starting to save the book...');
    startSaving();
  }
});

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function startSaving() {
  const nextButton = document.querySelector('.edge-right');
  if (!nextButton) {
    console.error('Could not find the next page button.');
    alert('Could not find the next page button.');
    return;
  }

  const slider = document.getElementById('reader-slider-range');
  if (!slider) {
      console.error('Could not find the page slider.');
      alert('Could not find the page slider.');
      return;
  }

  let isLastPage = false;

  // Get book title
  let bookTitle = document.querySelector('h1')?.innerText || document.querySelector('.title-text')?.innerText || 'Untitled_Book';
  bookTitle = bookTitle.replace(/[^a-zA-Z0-9 ]/g, '').trim();

  while (!isLastPage) {
    const currentPageNum = parseInt(slider.value, 10);
    const totalPages = parseInt(slider.max, 10);
    isLastPage = currentPageNum === totalPages;

    console.log(`Processing page ${currentPageNum} of ${totalPages}`);

    // Send message to background script to take a screenshot
    await new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'capturePage' }, (response) => {
        console.log('Screenshot response:', response);
        resolve();
      });
    });

    await delay(500); // Small delay after taking screenshot

    if (!isLastPage) {
      nextButton.click();
      await delay(1000); // wait for page to load
    }
  }

  console.log('Finished processing all pages.');
  chrome.runtime.sendMessage({ action: 'savingFinished', title: bookTitle });
  alert('Finished saving book!');
}

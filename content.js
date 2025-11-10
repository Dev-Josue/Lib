chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startSaving') {
    console.log('Starting to save the book with improved logic...');
    startSaving();
  }
});

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function startSaving() {
  const slider = document.getElementById('reader-slider-range');
  if (!slider) {
      console.error('Could not find the page slider.');
      alert('Could not find the page slider.');
      return;
  }

  let isLastPage = false;

  let bookTitle = document.querySelector('h1')?.innerText || document.querySelector('.title-text')?.innerText || 'Untitled_Book';
  bookTitle = bookTitle.replace(/[^a-zA-Z0-9 ]/g, '').trim();

  while (!isLastPage) {
    const currentPageNum = parseInt(slider.value, 10);
    const totalPages = parseInt(slider.max, 10);
    isLastPage = currentPageNum === totalPages;

    console.log(`Processing page ${currentPageNum} of ${totalPages}`);

    await delay(1500);

    const iframe = document.querySelector('iframe');
    if (!iframe || !iframe.contentDocument || !iframe.contentDocument.body) {
      console.error('Could not find the book iframe or its content.');
      alert('Could not find the book iframe. Cannot continue.');
      return;
    }

    // Capture only the visible area of the iframe
    const canvas = await html2canvas(iframe.contentDocument.body, {
      allowTaint: true,
      useCORS: true,
      width: iframe.clientWidth,
      height: iframe.clientHeight
    });
    const dataUrl = canvas.toDataURL('image/jpeg');

    await new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'capturePage', dataUrl: dataUrl }, (response) => {
        console.log('Screenshot response:', response);
        resolve();
      });
    });

    if (!isLastPage) {
      // Dispatch the event to the iframe's window
      iframe.contentWindow.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        keyCode: 39,
        bubbles: true
      }));
    }
  }

  console.log('Finished processing all pages.');
  chrome.runtime.sendMessage({ action: 'savingFinished', title: bookTitle });
  alert('Finished saving book!');
}

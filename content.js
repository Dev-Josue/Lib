chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startSaving') {
    console.log('Starting to save the book with precise spread capture...');
    startSaving();
  }
});

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function startSaving() {
  let bookTitle = document.querySelector('h1')?.innerText || document.querySelector('.title-text')?.innerText || 'Untitled_Book';
  bookTitle = bookTitle.replace(/[^a-zA-Z0-9 ]/g, '').trim();

  let previousPageHTML = '';
  let currentPageHTML = '';
  let pageCount = 0;

  while (true) {
    pageCount++;
    console.log(`Processing page ${pageCount}`);

    await delay(2000);

    const iframe = document.querySelector('iframe');
    if (!iframe || !iframe.contentDocument || !iframe.contentDocument.body) {
      console.error('Could not find the book iframe.');
      alert('Could not find the book iframe. Cannot continue.');
      return;
    }

    const iframeDoc = iframe.contentDocument;
    currentPageHTML = iframeDoc.body.innerHTML;

    if (pageCount > 1 && currentPageHTML === previousPageHTML) {
      console.log('End of book detected.');
      break;
    }

    // Find the specific spread divs
    const spreadDivs = iframeDoc.querySelectorAll('div[id^="spread_"]');
    if (spreadDivs.length === 0) {
        console.warn(`No spread divs found on page ${pageCount}. Turning page to continue.`);
        previousPageHTML = currentPageHTML;
        iframe.contentWindow.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', keyCode: 39, bubbles: true }));
        continue;
    }

    // Create a temporary container to generate a clean image of the spread
    const tempContainer = iframeDoc.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px'; // Move off-screen
    tempContainer.style.display = 'inline-block';
    iframeDoc.body.appendChild(tempContainer);

    let totalWidth = 0;
    let maxHeight = 0;

    // Clone all spread divs into the container
    spreadDivs.forEach(div => {
        const clone = div.cloneNode(true);
        clone.style.transform = ''; // Remove any transforms
        tempContainer.appendChild(clone);
        totalWidth += div.offsetWidth;
        if (div.offsetHeight > maxHeight) {
            maxHeight = div.offsetHeight;
        }
    });

    // Capture the temporary container
    const canvas = await html2canvas(tempContainer, {
      allowTaint: true,
      useCORS: true,
      width: totalWidth,
      height: maxHeight,
    });
    const dataUrl = canvas.toDataURL('image/jpeg');

    // Clean up by removing the container
    iframeDoc.body.removeChild(tempContainer);

    await new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'capturePage', dataUrl: dataUrl }, (response) => {
        console.log('Screenshot response:', response);
        resolve();
      });
    });

    previousPageHTML = currentPageHTML;

    iframe.contentWindow.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      keyCode: 39,
      bubbles: true
    }));
  }

  console.log('Finished processing all pages.');
  chrome.runtime.sendMessage({ action: 'savingFinished', title: bookTitle });
  alert('Finished saving book!');
}

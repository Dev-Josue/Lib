chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startSaving') {
    console.log('Starting to save the book with specific iframe selection...');
    startSaving();
  }
});

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getIframeByXPath(xpath) {
  const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
  return result.singleNodeValue;
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

    const iframeXPath = "/html/body/div[1]/div[2]/div/div[1]/div[1]/div/div/div[2]/div[1]/div/div/iframe";
    const iframe = getIframeByXPath(iframeXPath);

    if (!iframe || !iframe.contentDocument || !iframe.contentDocument.body) {
      console.error('Could not find the book iframe using the provided XPath.');
      alert('Could not find the book iframe. Cannot continue.');
      return;
    }

    const iframeDoc = iframe.contentDocument;
    currentPageHTML = iframeDoc.body.innerHTML;

    if (pageCount > 1 && currentPageHTML === previousPageHTML) {
      console.log('End of book detected.');
      break;
    }

    const spreadDivs = iframeDoc.querySelectorAll('div[id^="spread_"]');
    if (spreadDivs.length === 0) {
        console.warn(`No spread divs found on page ${pageCount}. Turning page to continue.`);
        previousPageHTML = currentPageHTML;
        iframe.contentWindow.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', keyCode: 39, bubbles: true }));
        continue;
    }

    const tempContainer = iframeDoc.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.display = 'inline-block';
    iframeDoc.body.appendChild(tempContainer);

    let totalWidth = 0;
    let maxHeight = 0;

    spreadDivs.forEach(div => {
        const clone = div.cloneNode(true);
        clone.style.transform = '';
        tempContainer.appendChild(clone);
        totalWidth += div.offsetWidth;
        if (div.offsetHeight > maxHeight) {
            maxHeight = div.offsetHeight;
        }
    });

    const canvas = await html2canvas(tempContainer, {
      allowTaint: true,
      useCORS: true,
      width: totalWidth,
      height: maxHeight,
    });
    const dataUrl = canvas.toDataURL('image/jpeg');

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

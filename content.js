chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startSaving') {
    console.log('Starting to save the book with polling for iframe...');
    startSaving();
  }
});

function getIframeByXPath(xpath) {
  const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
  return result.singleNodeValue;
}

/**
 * Waits for an element to exist in the DOM.
 * @param {string} xpath The XPath of the element to wait for.
 * @param {number} timeout The maximum time to wait in milliseconds.
 * @returns {Promise<Element>} A promise that resolves with the element when it is found.
 */
function waitForElement(xpath, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const intervalTime = 100; // Check every 100ms
    let elapsedTime = 0;

    const interval = setInterval(() => {
      const element = getIframeByXPath(xpath);
      if (element && element.contentDocument && element.contentDocument.body) {
        clearInterval(interval);
        resolve(element);
      } else {
        elapsedTime += intervalTime;
        if (elapsedTime >= timeout) {
          clearInterval(interval);
          reject(new Error(`Timeout: Element with XPath "${xpath}" not found or not ready after ${timeout}ms`));
        }
      }
    }, intervalTime);
  });
}

async function startSaving() {
  let bookTitle = document.querySelector('h1')?.innerText || document.querySelector('.title-text')?.innerText || 'Untitled_Book';
  bookTitle = bookTitle.replace(/[^a-zA-Z0-9 ]/g, '').trim();

  const iframeXPath = "/html/body/div[1]/div[2]/div/div[1]/div[1]/div/div/div[2]/div[1]/div/div/iframe";
  let iframe;

  try {
    console.log('Waiting for the book iframe to load...');
    iframe = await waitForElement(iframeXPath, 20000); // Wait up to 20 seconds
    console.log('Book iframe found. Starting capture process.');
  } catch (error) {
    console.error(error.message);
    alert('Could not find the book iframe. Please make sure the book is fully loaded and try again.');
    return;
  }

  let previousPageHTML = '';
  let currentPageHTML = '';
  let pageCount = 0;

  while (true) {
    pageCount++;
    console.log(`Processing page ${pageCount}`);

    // Delay for page content to settle after turning
    await new Promise(resolve => setTimeout(resolve, 2000));

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

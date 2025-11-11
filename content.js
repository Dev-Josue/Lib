// Only run this script in the top-level frame to avoid multiple executions
if (window.self === window.top) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startSaving') {
      console.log('Starting to save the book in the main frame...');
      startSaving();
      // Keep the message channel open for the async response
      return true;
    }
  });
}

function getIframeByXPath(xpath) {
  const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
  return result.singleNodeValue;
}

function waitForElement(xpath, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const intervalTime = 100;
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
          reject(new Error(`Timeout: Element with XPath "${xpath}" not found after ${timeout}ms`));
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
    console.log('Waiting for the book iframe...');
    iframe = await waitForElement(iframeXPath, 20000);
    console.log('Book iframe found. Starting process.');
  } catch (error) {
    console.error(error.message);
    alert('Could not find the book iframe. Please ensure the book is loaded and try again.');
    return;
  }

  let previousPageHTML = '';
  let currentPageHTML = '';
  let pageCount = 0;

  while (true) {
    pageCount++;
    console.log(`Processing page ${pageCount}`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    const iframeDoc = iframe.contentDocument;
    currentPageHTML = iframeDoc.body.innerHTML;

    if (pageCount > 1 && currentPageHTML === previousPageHTML) {
      console.log('End of book detected.');
      break;
    }

    const spreadDivs = iframeDoc.querySelectorAll('div[id^="spread_"]');
    if (spreadDivs.length === 0) {
        console.warn(`No spread divs found on page ${pageCount}. Continuing.`);
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

    previousPageHTML = currentPage.innerHTML;

    // Dispatch event to the iframe's window to turn the page
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

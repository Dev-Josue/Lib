importScripts('jszip.min.js');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'clearScreenshots') {
    chrome.storage.local.set({ screenshots: [] }, () => {
      console.log('Screenshots cleared from storage.');
      sendResponse({ status: 'cleared' });
    });
    return true; // async
  }

  if (request.action === 'capturePage') {
    const dataUrl = request.dataUrl;
    if (dataUrl) {
      chrome.storage.local.get('screenshots', (data) => {
        const screenshots = data.screenshots || [];
        screenshots.push(dataUrl);
        chrome.storage.local.set({ screenshots }, () => {
          console.log('Screenshot saved, total:', screenshots.length);
          sendResponse({ status: 'screenshot saved' });
        });
      });
    } else {
      console.error('No image data received.');
      sendResponse({ status: 'error', message: 'No dataUrl provided' });
    }
    return true;
  }

  if (request.action === 'savingFinished') {
    console.log(`Finished saving pages for "${request.title}".`);
    createZipFile(request.title);
    sendResponse({ status: 'zip creation started' });
  }
});

function dataURLtoBlob(dataurl) {
    var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], {type:mime});
}

async function createZipFile(bookTitle) {
  chrome.storage.local.get('screenshots', async (data) => {
    const screenshots = data.screenshots || [];
    if (screenshots.length === 0) {
      console.error('No screenshots found to create a zip file.');
      return;
    }

    const zip = new JSZip();

    screenshots.forEach((dataUrl, i) => {
      const blob = dataURLtoBlob(dataUrl);
      const pageNum = String(i + 1).padStart(3, '0');
      zip.file(`page_${pageNum}.jpg`, blob);
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);

    chrome.downloads.download({
      url: url,
      filename: `${bookTitle}.cbz`,
      saveAs: true
    }, (downloadId) => {
      URL.revokeObjectURL(url);
      chrome.storage.local.set({ screenshots: [] });
    });
  });
}

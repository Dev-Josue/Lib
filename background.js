importScripts('jszip.min.js');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'createCbz') {
    console.log(`Received request to create CBZ file with title: "${request.title}"`);
    createZipFile(request.title);
    sendResponse({ status: 'CBZ creation process started' });
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
      // Optionally, send a message back to the popup to inform the user.
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

    // Use chrome.downloads.download to save the file
    chrome.downloads.download({
      url: url,
      filename: `${bookTitle}.cbz` // Automatically saves to the Downloads folder
    }, (downloadId) => {
      // After the download starts, revoke the object URL to free up memory.
      URL.revokeObjectURL(url);

      // Clear the storage for the next book.
      // Note: We might want to make this clearing optional or user-triggered in the future.
      chrome.storage.local.set({ screenshots: [], bookTitle: '' });
    });
  });
}

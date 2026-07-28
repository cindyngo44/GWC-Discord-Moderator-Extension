chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "getStudentName") {

    const tryGetName = () => {
      const el = document.querySelector('.MuiTypography-h2');
      return el?.innerText?.trim() || "";
    };

    const existingName = tryGetName();
    if (existingName) {
      sendResponse({ studentName: existingName });
      return;
    }

    const observer = new MutationObserver(() => {
      const name = tryGetName();
      if (name) {
        observer.disconnect();
        clearTimeout(timeoutId);
        sendResponse({ studentName: name });
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    const timeoutId = setTimeout(() => {
      observer.disconnect();
      sendResponse({ studentName: "" });
    }, 5000);

    return true;
  }
});
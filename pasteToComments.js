if (!window.__gwcPasteTemplate) {

  window.__gwcPasteTemplate = async function (text) {

    const editor = await openCommentEditor();

    clickInto(editor);

    const pasted = dispatchPaste(editor, text);

    return {
      found: true,
      isFocused:
        document.activeElement === editor,
      pasted
    };
  };

  function findAddCommentsButton() {

    const buttons =
      document.querySelectorAll("button");

    const matches = [];

    for (const button of buttons) {
      if (
        button.textContent.trim() ===
        "Add comments"
      ) {
        matches.push(button);
      }
    }

    console.log(
      `[GWC] Found ${matches.length} "Add comments" button(s)`
    );

    return matches[0] || null;
  }


  function findDraftEditor() {

    const editors = document.querySelectorAll(
      '.public-DraftEditor-content[contenteditable="true"]'
    );

    console.log(
      `[GWC] Found ${editors.length} Draft.js editor(s) on page`
    );

    return editors[0] || null;
  }

  function waitForDraftEditor(timeoutMs = 5000) {

    return new Promise((resolve, reject) => {

      const existing = findDraftEditor();

      if (existing) {
        resolve(existing);
        return;
      }

      const observer = new MutationObserver(() => {
        const editor = findDraftEditor();
        if (editor) {
          observer.disconnect();
          resolve(editor);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(
          new Error(
            "Timed out waiting for the comment box to open."
          )
        );
      }, timeoutMs);
    });
  }

  async function openCommentEditor() {

    const existingEditor = findDraftEditor();

    if (existingEditor) {
      console.log("[GWC] Editor already open, skipping click");
      return existingEditor;
    }

    const button = findAddCommentsButton();

    if (!button) {
      throw new Error(
        'Could not find the "Add comments" button on this page.'
      );
    }

    console.log("[GWC] Clicking Add comments button");
    button.click();

    return waitForDraftEditor();
  }

  function clickInto(editor) {

    const rect = editor.getBoundingClientRect();

    const clickX = rect.left + 10;
    const clickY = rect.top + 10;

    const eventOptions = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: clickX,
      clientY: clickY
    };

    editor.dispatchEvent(
      new MouseEvent("mousedown", eventOptions)
    );

    editor.dispatchEvent(
      new MouseEvent("mouseup", eventOptions)
    );

    editor.dispatchEvent(
      new MouseEvent("click", eventOptions)
    );

    editor.focus();

    console.log(
      "[GWC] Clicked into editor, focused:",
      document.activeElement === editor
    );
  }

  function dispatchPaste(editor, text) {

    const dataTransfer = new DataTransfer();
    dataTransfer.setData("text/plain", text);

    const pasteEvent = new ClipboardEvent("paste", {
      clipboardData: dataTransfer,
      bubbles: true,
      cancelable: true
    });

    const dispatched = editor.dispatchEvent(pasteEvent);

    console.log(
      "[GWC] Dispatched paste event, default not prevented:",
      dispatched
    );

    return dispatched;
  }
}
// =========================
// GOOGLE SHEET CONFIGURATION
// =========================

import { SHEET_ID } from './config.js';

const SHEET_URL =
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=426380133`;


// =========================
// TEMPLATE DATA
// =========================
let categorizedTemplates = {};
let categoryOrder = [];


// =========================
// PAGE INITIALIZATION
// =========================

document.addEventListener("DOMContentLoaded", async () => {

  setupThemeToggle();

  loadSavedEmail();

  autoDetectStudentName();

  try {

    await loadAllTemplates();

    buildCategoryUI(categorizedTemplates, categoryOrder);

    renderAllTemplates();

  } catch (error) {

    console.error(
      "Error loading templates:",
      error
    );

    const cached = await getCachedTemplates();

    if (cached) {

      categorizedTemplates = cached.categorizedTemplates;

      buildCategoryUI(categorizedTemplates, categoryOrder);

      renderAllTemplates();

      showToast(
        "Showing cached templates"
      );

    } else {

      showToast(
        "Could not load templates"
      );

      document.getElementById(
        "tab-content-container"
      ).innerHTML =
        "<p>Could not load templates.</p>";
    }
  }
});

// =========================
// THEME TOGGLE
// =========================

function setupThemeToggle() {

  const toggleBtn = document.getElementById("themeToggle");
  if (!toggleBtn) return;

  chrome.storage.local.get(["theme"], (result) => {
    const theme = result.theme || "light";
    applyTheme(theme);
  });

  toggleBtn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "light" ? "dark" : "light";

    applyTheme(next);

    chrome.storage.local.set({ theme: next });
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);

  const moonIcon = document.querySelector(".icon-moon");
  const sunIcon = document.querySelector(".icon-sun");

  if (moonIcon && sunIcon) {
    if (theme === "dark") {
      moonIcon.style.display = "none";
      sunIcon.style.display = "block";
    } else {
      moonIcon.style.display = "block";
      sunIcon.style.display = "none";
    }
  }
}

// =========================
// LOAD SAVED MOD EMAIL
// =========================

function loadSavedEmail() {

  chrome.storage.local.get(
    ["modEmail"],
    (result) => {

      if (chrome.runtime.lastError) {

        console.error(
          "Storage error:",
          chrome.runtime.lastError
        );

        return;
      }

      const emailInput =
        document.getElementById(
          "modEmail"
        );

      if (
        emailInput &&
        result.modEmail
      ) {

        emailInput.value =
          result.modEmail;
      }

      updateAllPreviews();
    }
  );
}


// =========================
// SAVE MOD EMAIL
// =========================

document.addEventListener(
  "input",
  (event) => {

    if (
      event.target.id ===
      "modEmail"
    ) {

      const email =
        event.target.value;

      chrome.storage.local.set(
        {
          modEmail: email
        },
        () => {

          if (
            chrome.runtime.lastError
          ) {

            console.error(
              "Could not save email:",
              chrome.runtime.lastError
            );

            return;
          }

          updateAllPreviews();
        }
      );
    }

    if (
      event.target.id ===
      "studentName"
    ) {

      updateAllPreviews();
    }
  }
);


// =========================
// LOAD ALL TEMPLATES
// =========================

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function loadAllTemplates() {

  const cached = await getCachedTemplates();

  if (cached) {
    categorizedTemplates = cached.categorizedTemplates;
    categoryOrder = cached.categoryOrder;
    return;
  }

  const allRows = await loadSheet(SHEET_URL);

  console.log(
    "Raw category order from CSV:",
    allRows.map(row => row.category)
  );

  categorizedTemplates = groupByCategory(allRows);
  categoryOrder = getCategoryOrder(allRows, categorizedTemplates);

  chrome.storage.local.set({
    templateCache: {
      categorizedTemplates,
      categoryOrder,
      timestamp: Date.now()
    }
  });
}

function getCachedTemplates() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["templateCache"], (result) => {
      const cache = result.templateCache;
      if (cache && (Date.now() - cache.timestamp) < CACHE_TTL_MS) {
        resolve(cache);
      } else {
        resolve(null);
      }
    });
  });
}


// =========================
// GROUP ROWS BY CATEGORY
// =========================

function groupByCategory(rows) {

  const grouped = {};

  rows.forEach((row) => {

    const category =
      row.category ||
      "uncategorized";

    if (!grouped[category]) {
      grouped[category] = [];
    }

    grouped[category].push(row);
  });

  return grouped;
}


// =========================
// LOAD ONE GOOGLE SHEET
// =========================

async function loadSheet(url) {

  console.log(
    "Loading sheet:",
    url
  );

  const response =
    await fetch(url);

  console.log(
    "Response status:",
    response.status
  );

  if (!response.ok) {

    throw new Error(
      `Failed to load Google Sheet: ${response.status}`
    );
  }

  const csvText =
    await response.text();

  console.log(
    "CSV received:",
    csvText.slice(0, 500)
  );

  return parseCSV(csvText);
}


// =========================
// CSV PARSER
// =========================

function parseCSV(csvText) {

  const rows = [];

  let row = [];

  let currentValue = "";

  let insideQuotes = false;


  for (
    let i = 0;
    i < csvText.length;
    i++
  ) {

    const character =
      csvText[i];

    const nextCharacter =
      csvText[i + 1];


    if (
      character === '"' &&
      insideQuotes &&
      nextCharacter === '"'
    ) {

      currentValue += '"';

      i++;
    }


    else if (
      character === '"'
    ) {

      insideQuotes =
        !insideQuotes;
    }


    else if (
      character === "," &&
      !insideQuotes
    ) {

      row.push(
        currentValue
      );

      currentValue =
        "";
    }


    else if (
      (
        character === "\n" ||
        character === "\r"
      ) &&
      !insideQuotes
    ) {

      if (
        character === "\r" &&
        nextCharacter === "\n"
      ) {

        i++;
      }

      row.push(
        currentValue
      );

      rows.push(
        row
      );

      row =
        [];

      currentValue =
        "";
    }


    else {

      currentValue +=
        character;
    }
  }

  if (
    currentValue !== "" ||
    row.length > 0
  ) {

    row.push(
      currentValue
    );

    rows.push(
      row
    );
  }


  if (
    rows.length < 2
  ) {

    return [];
  }


  const headers =
    rows[0].map(
      header =>
        header
          .trim()
          .toLowerCase()
    );


  const categoryIndex =
    headers.indexOf(
      "category"
    );

  const titleIndex =
    headers.indexOf(
      "title"
    );

  const messageIndex =
    headers.indexOf(
      "message"
    );

  const orderIndex =
    headers.indexOf(
      "order"
    );


  if (
    categoryIndex === -1 ||
    titleIndex === -1 ||
    messageIndex === -1
  ) {

    throw new Error(
      "Google Sheet must contain 'Category', 'Title', and 'Message' columns."
    );
  }


  return rows
    .slice(1)

    .filter(
      row =>
        row[titleIndex] &&
        row[messageIndex]
    )

    .map(
      row => ({

        category:
          (row[categoryIndex] || "")
            .trim()
            .toLowerCase(),

        title:
          row[titleIndex]
            .trim(),

        message:
          row[messageIndex]
            .trim(),

        order:
          orderIndex !== -1
            ? (row[orderIndex] || "").trim()
            : undefined
      })
    );
}


// =========================
// DETERMINE CATEGORY (TAB) ORDER
// =========================

function getCategoryOrder(rows, categorizedTemplates) {

  const categoryNames =
    Object.keys(categorizedTemplates);

  const hasExplicitOrder =
    rows.some(
      row =>
        row.order !== undefined &&
        row.order !== ""
    );

  if (!hasExplicitOrder) {
    return categoryNames;
  }

  // Use the first numeric Order value found for each category.
  const orderMap = {};

  rows.forEach(row => {

    const category =
      row.category ||
      "uncategorized";

    const orderValue =
      parseFloat(row.order);

    if (
      !Number.isNaN(orderValue) &&
      orderMap[category] === undefined
    ) {
      orderMap[category] = orderValue;
    }
  });

  return categoryNames
    .slice()
    .sort((a, b) => {

      const orderA =
        orderMap[a] ?? Infinity;

      const orderB =
        orderMap[b] ?? Infinity;

      if (orderA === orderB) {
        return (
          categoryNames.indexOf(a) -
          categoryNames.indexOf(b)
        );
      }

      return orderA - orderB;
    });
}


// =========================
// BUILD TABS + CONTENT PANELS FROM CATEGORIES
// =========================

function buildCategoryUI(categorizedTemplates, categoryOrder) {

  const tabsContainer =
    document.getElementById(
      "tabs-container"
    );

  const contentContainer =
    document.getElementById(
      "tab-content-container"
    );

  if (!tabsContainer || !contentContainer) {
    return;
  }

  tabsContainer.innerHTML = "";
  contentContainer.innerHTML = "";

  const categoryNames =
    categoryOrder && categoryOrder.length
      ? categoryOrder
      : Object.keys(categorizedTemplates);

  if (categoryNames.length === 0) {
    contentContainer.innerHTML =
      "<p>No templates found.</p>";
    return;
  }

  categoryNames.forEach(
    (category, index) => {

      const tabId =
        slugify(category);

      const button =
        document.createElement(
          "button"
        );

      button.className =
        "tab-btn" +
        (index === 0 ? " active" : "");

      button.dataset.tab = tabId;

      button.textContent =
        toTitleCase(category);

      tabsContainer.appendChild(
        button
      );

      const contentDiv =
        document.createElement(
          "div"
        );

      contentDiv.className =
        "tab-content" +
        (index === 0 ? " active" : "");

      contentDiv.id = tabId;

      const section =
        document.createElement(
          "div"
        );

      section.className =
        "section";

      const label =
        document.createElement(
          "label"
        );

      label.textContent =
        toTitleCase(category) +
        " Templates:";

      const listContainer =
        document.createElement(
          "div"
        );

      listContainer.id =
        tabId + "-templates";

      section.appendChild(label);
      section.appendChild(listContainer);
      contentDiv.appendChild(section);
      contentContainer.appendChild(contentDiv);
    }
  );

  setupTabs();
}

function slugify(text) {
  return (text || "uncategorized")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "uncategorized";
}

function toTitleCase(text) {
  return (text || "Uncategorized").replace(
    /\w\S*/g,
    (word) =>
      word.charAt(0).toUpperCase() +
      word.slice(1)
  );
}


// =========================
// RENDER ALL CATEGORIES
// =========================

function renderAllTemplates() {

  Object.entries(
    categorizedTemplates
  ).forEach(
    ([category, list]) => {

      const containerId =
        slugify(category) +
        "-templates";

      renderTemplates(
        list,
        containerId,
        category
      );
    }
  );
}


// =========================
// RENDER TEMPLATE CARDS
// =========================

function renderTemplates(
  templateList,
  containerId,
  category
) {

  const container =
    document.getElementById(
      containerId
    );


  if (!container) {

    return;
  }


  container.innerHTML =
    "";


  templateList.forEach(
    (
      template,
      index
    ) => {

      const card =
        document.createElement(
          "div"
        );

      card.className =
        "template-card";


      const title =
        document.createElement(
          "div"
        );

      title.className =
        "template-title";

      title.textContent =
        template.title;


      const preview =
        document.createElement(
          "div"
        );

      preview.className =
        "template-preview";

      preview.dataset.templateIndex =
        index;


      const buttons =
        document.createElement(
          "div"
        );

      buttons.className =
        "buttons";


      const copyButton =
        document.createElement(
          "button"
        );

      copyButton.className =
        "copy-btn";

      copyButton.textContent =
        "Copy";


      copyButton.addEventListener(
        "click",
        () => {

          copyTemplate(
            template.message
          );
        }
      );


      buttons.appendChild(
        copyButton
      );

      if (
        category === "role assignment"
      ) {

        const pasteButton =
          document.createElement(
            "button"
          );

        pasteButton.className =
          "paste-btn";

        pasteButton.textContent =
          "Paste to Comments";

        pasteButton.addEventListener(
          "click",
          () => {

            pasteTemplateToPage(
              template.message
            );
          }
        );

        buttons.appendChild(
          pasteButton
        );
      }


      card.appendChild(
        title
      );

      card.appendChild(
        preview
      );

      card.appendChild(
        buttons
      );


      container.appendChild(
        card
      );
    }
  );


  updatePreviewsForContainer(
    templateList,
    containerId
  );
}


// =========================
// STUDENT NAME DETECTION
// =========================
function autoDetectStudentName() {

  chrome.tabs.query(
    {
      active: true,
      currentWindow: true
    },

    (
      tabs
    ) => {

      if (
        !tabs ||
        !tabs[0]
      ) {

        return;
      }


      chrome.tabs.sendMessage(
        tabs[0].id,

        {
          type:
            "getStudentName"
        },

        (
          response
        ) => {

          const input =
            document.getElementById(
              "studentName"
            );


          const name =
            response?.studentName ||
            "";


          if (
            input &&
            name &&
            !input.value
          ) {

            input.value =
              name;
          }


          updateAllPreviews();
        }
      );
    }
  );
}


// =========================
// UPDATE ALL PREVIEWS
// =========================

function updateAllPreviews() {

  Object.entries(
    categorizedTemplates
  ).forEach(
    ([category, list]) => {

      const containerId =
        slugify(category) +
        "-templates";

      updatePreviewsForContainer(
        list,
        containerId
      );
    }
  );
}


// =========================
// UPDATE TEMPLATE PREVIEWS
// =========================

function updatePreviewsForContainer(
  templateList,
  containerId
) {

  const studentName =
    document.getElementById(
      "studentName"
    )?.value || "";


  const modEmail =
    document.getElementById(
      "modEmail"
    )?.value || "";


  const container =
    document.getElementById(
      containerId
    );


  if (!container) {

    return;
  }


  const previews =
    container.querySelectorAll(
      ".template-preview"
    );


  templateList.forEach(
    (
      template,
      index
    ) => {

      const preview =
        previews[index];


      if (!preview) {

        return;
      }


      const fullText =
        replacePlaceholders(
          template.message,
          studentName,
          modEmail
        );


      preview.textContent =
        fullText.length > 100

          ? fullText.slice(
              0,
              100
            ) + "..."

          : fullText;
    }
  );
}


// =========================
// COPY TEMPLATE
// =========================

function copyTemplate(
  message
) {

  const studentName =
    document.getElementById(
      "studentName"
    )?.value ||
    "STUDENTNAME";


  const modEmail =
    document.getElementById(
      "modEmail"
    )?.value ||
    "MODEMAIL";


  const text =
    replacePlaceholders(
      message,
      studentName,
      modEmail
    );


  navigator.clipboard
    .writeText(
      text
    )

    .then(
      () => {

        showToast();
      }
    )

    .catch(
      (
        error
      ) => {

        console.error(
          "Could not copy template:",
          error
        );

        showToast(
          "Could not copy"
        );
      }
    );
}


// =========================
// PASTE TEMPLATE TO PAGE
// =========================

async function pasteTemplateToPage(
  message
) {

  const studentName =
    document.getElementById(
      "studentName"
    )?.value ||
    "STUDENTNAME";

  const modEmail =
    document.getElementById(
      "modEmail"
    )?.value ||
    "MODEMAIL";

  const text =
    replacePlaceholders(
      message,
      studentName,
      modEmail
    );

  try {

    const [tab] =
      await chrome.tabs.query({
        active: true,
        currentWindow: true
      });

    if (!tab) {
      showToast(
        "No active tab found"
      );
      return;
    }

    await chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        files: [
          "pasteToComments.js"
        ]
      }
    );

    const [injectionResult] =
      await chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          func: (templateText) =>
            window.__gwcPasteTemplate(
              templateText
            ),
          args: [text]
        }
      );

    console.log(
      "Paste result:",
      injectionResult?.result
    );

    if (injectionResult?.result?.pasted) {
      showToast(
        "Pasted to comments!"
      );
    } 
  } catch (error) {

    console.error(
      "Paste to page failed:",
      error
    );

    showToast(
      "Could not paste template"
    );
  }
}


// =========================
// REPLACE PLACEHOLDERS
// =========================

function replacePlaceholders(
  message,
  studentName,
  modEmail
) {

  return message

    .replace(
      /STUDENTNAME/g,
      studentName ||
        "STUDENTNAME"
    )

    .replace(
      /MODEMAIL/g,
      modEmail ||
        "MODEMAIL"
    );
}


// =========================
// TABS
// =========================

function setupTabs() {

  const tabButtons =
    document.querySelectorAll(
      ".tab-btn"
    );


  const contents =
    document.querySelectorAll(
      ".tab-content"
    );


  tabButtons.forEach(
    (
      button
    ) => {

      button.addEventListener(
        "click",
        () => {

          tabButtons.forEach(
            (
              btn
            ) => {

              btn.classList.remove(
                "active"
              );
            }
          );


          contents.forEach(
            (
              content
            ) => {

              content.classList.remove(
                "active"
              );
            }
          );


          button.classList.add(
            "active"
          );


          const tabId =
            button.dataset.tab;


          document
            .getElementById(
              tabId
            )
            .classList.add(
              "active"
            );
        }
      );
    }
  );
}


// =========================
// TOAST
// =========================

function showToast(
  message = "Copied!"
) {

  const toast =
    document.getElementById(
      "toast"
    );


  if (!toast) {

    return;
  }


  toast.textContent =
    message;


  toast.classList.add(
    "show"
  );


  setTimeout(
    () => {

      toast.classList.remove(
        "show"
      );
    },

    1000
  );
}
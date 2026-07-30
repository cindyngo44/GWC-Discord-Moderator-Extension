// =========================
// GOOGLE SHEET CONFIGURATION
// =========================

import { SHEET_ID } from './config.js';

const SHEET_URL =
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=426380133`;


// =========================
// TEMPLATE DATA
// =========================

let templates = [];
let discordTemplates = [];
let emailTemplates = [];


// =========================
// PAGE INITIALIZATION
// =========================

document.addEventListener("DOMContentLoaded", async () => {

  setupTabs();

  setupThemeToggle();

  loadSavedEmail();

  autoDetectStudentName();

  try {

    await loadAllTemplates();

    renderTemplates(
      templates,
      "role-assignment-templates"
    );

    renderTemplates(
      discordTemplates,
      "discord-message-templates"
    );

    renderTemplates(
      emailTemplates,
      "email-templates"
    );

  } catch (error) {

    console.error(
      "Error loading templates:",
      error
    );

    const cached = await getCachedTemplates();

    if (cached) {

      templates = cached.templates;
      discordTemplates = cached.discordTemplates;
      emailTemplates = cached.emailTemplates;

      renderTemplates(
        templates,
        "role-assignment-templates"
      );

      renderTemplates(
        discordTemplates,
        "discord-message-templates"
      );

      renderTemplates(
        emailTemplates,
        "email-templates"
      );

      showToast(
        "Showing cached templates"
      );

    } else {

      showToast(
        "Could not load templates"
      );

      document.getElementById(
        "role-assignment-templates"
      ).innerHTML =
        "<p>Could not load templates.</p>";

      document.getElementById(
        "discord-message-templates"
      ).innerHTML =
        "<p>Could not load templates.</p>";

      document.getElementById(
        "email-templates"
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
    templates = cached.templates;
    discordTemplates = cached.discordTemplates;
    emailTemplates = cached.emailTemplates;
    return;
  }

  const allRows = await loadSheet(SHEET_URL);

  templates = allRows.filter(
    row => row.category === "role assignment"
  );

  discordTemplates = allRows.filter(
    row => row.category === "discord message"
  );

  emailTemplates = allRows.filter(
    row => row.category === "email"
  );

  chrome.storage.local.set({
    templateCache: {
      templates,
      discordTemplates,
      emailTemplates,
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
// CSV PARSER (now also reads Category)
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


  // Add final value

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
            .trim()
      })
    );
}


// =========================
// RENDER TEMPLATE CARDS
// =========================

function renderTemplates(
  templateList,
  containerId
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


  updateAllPreviews();
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

  const name =
    document.getElementById(
      "studentName"
    )?.value || "";


  const email =
    document.getElementById(
      "modEmail"
    )?.value || "";


  updatePreviews(
    templates,
    "role-assignment-templates",
    name,
    email
  );


  updatePreviews(
    discordTemplates,
    "discord-message-templates",
    name,
    email
  );


  updatePreviews(
    emailTemplates,
    "email-templates",
    name,
    email
  );
}


// =========================
// UPDATE TEMPLATE PREVIEWS
// =========================

function updatePreviews(
  templateList,
  containerId,
  studentName,
  modEmail
) {

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
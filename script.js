/* DOM elements: builder controls */
const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsCount = document.getElementById("productsCount");
const productGrid = document.getElementById("productGrid");
const selectedList = document.getElementById("selectedList");
const selectedEmpty = document.getElementById("selectedEmpty");
const clearSelectedBtn = document.getElementById("clearSelectedBtn");
const generateRoutineBtn = document.getElementById("generateRoutineBtn");
const directionToggle = document.getElementById("directionToggle");

/* DOM elements: chat area */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn = document.getElementById("sendBtn");
const latestQuestion = document.getElementById("latestQuestion");

const STORAGE_KEY = "lorealSelectedProductIds";
const DIRECTION_STORAGE_KEY = "lorealDirectionPreference";

// Optional local override: define window.LOCAL_CONFIG.WORKER_URL before script.js.
const localConfig = window.LOCAL_CONFIG || {};
const DEFAULT_WORKER_URL = "https://l0realchatbot.easmit60.workers.dev";

function resolveChatEndpoint(url) {
  const trimmedUrl = url.replace(/\/$/, "");

  if (trimmedUrl.endsWith("/api/chat")) {
    return trimmedUrl;
  }

  return `${trimmedUrl}/api/chat`;
}

const WORKER_URL = resolveChatEndpoint(
  localConfig.WORKER_URL || DEFAULT_WORKER_URL,
);

const appState = {
  products: [],
  selectedIds: new Set(),
  activeCategory: "all",
  searchText: "",
  routineGenerated: false,
};

// Full message history for follow-up chat after routine generation.
let conversationMessages = [];

function normalizeText(text) {
  return String(text || "").toLowerCase();
}

function getSelectedProducts() {
  return appState.products.filter((product) =>
    appState.selectedIds.has(product.id),
  );
}

function saveSelectedProducts() {
  const selectedIdArray = [...appState.selectedIds];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedIdArray));
}

function loadSelectedProducts() {
  try {
    const rawValue = localStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return;
    }

    const parsedIds = JSON.parse(rawValue);
    if (!Array.isArray(parsedIds)) {
      return;
    }

    for (const id of parsedIds) {
      if (Number.isInteger(id)) {
        appState.selectedIds.add(id);
      }
    }
  } catch (error) {
    console.error("Could not load selected products from localStorage", error);
  }
}

function renderCategoryOptions() {
  const uniqueCategories = [
    ...new Set(appState.products.map((product) => product.category)),
  ].sort((a, b) => a.localeCompare(b));

  categoryFilter.innerHTML = '<option value="all">All categories</option>';

  for (const category of uniqueCategories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category.charAt(0).toUpperCase() + category.slice(1);
    categoryFilter.appendChild(option);
  }
}

function createProductCard(product) {
  const isSelected = appState.selectedIds.has(product.id);

  const card = document.createElement("article");
  card.className = `product-card${isSelected ? " selected" : ""}`;
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-pressed", String(isSelected));
  card.setAttribute("aria-label", `Select ${product.brand} ${product.name}`);

  const image = document.createElement("img");
  image.className = "product-image";
  image.src = product.image;
  image.alt = `${product.brand} ${product.name}`;

  const name = document.createElement("h3");
  name.className = "product-name";
  name.textContent = product.name;

  const meta = document.createElement("p");
  meta.className = "product-meta";
  meta.textContent = `${product.brand} | ${product.category}`;

  const toggleDescriptionBtn = document.createElement("button");
  toggleDescriptionBtn.type = "button";
  toggleDescriptionBtn.className = "desc-toggle";
  toggleDescriptionBtn.textContent = "Show description";
  toggleDescriptionBtn.setAttribute("aria-expanded", "false");

  const description = document.createElement("p");
  description.className = "product-description";
  description.hidden = true;
  description.textContent = product.description;

  toggleDescriptionBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const isExpanded =
      toggleDescriptionBtn.getAttribute("aria-expanded") === "true";
    toggleDescriptionBtn.setAttribute("aria-expanded", String(!isExpanded));
    toggleDescriptionBtn.textContent = isExpanded
      ? "Show description"
      : "Hide description";
    description.hidden = isExpanded;
  });

  function handleSelectionToggle() {
    if (appState.selectedIds.has(product.id)) {
      appState.selectedIds.delete(product.id);
    } else {
      appState.selectedIds.add(product.id);
    }

    saveSelectedProducts();
    renderProducts();
    renderSelectedProducts();
  }

  card.addEventListener("click", handleSelectionToggle);

  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSelectionToggle();
    }
  });

  card.appendChild(image);
  card.appendChild(name);
  card.appendChild(meta);
  card.appendChild(toggleDescriptionBtn);
  card.appendChild(description);

  return card;
}

function renderProducts() {
  const filteredProducts = appState.products.filter((product) => {
    const matchesCategory =
      appState.activeCategory === "all" ||
      product.category === appState.activeCategory;

    const searchTerm = normalizeText(appState.searchText);
    const searchable = normalizeText(
      `${product.name} ${product.brand} ${product.category} ${product.description}`,
    );
    const matchesSearch = !searchTerm || searchable.includes(searchTerm);

    return matchesCategory && matchesSearch;
  });

  productGrid.innerHTML = "";

  if (filteredProducts.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-grid";
    emptyState.textContent = "No products match your current filters.";
    productGrid.appendChild(emptyState);
  } else {
    for (const product of filteredProducts) {
      productGrid.appendChild(createProductCard(product));
    }
  }

  productsCount.textContent = `Showing ${filteredProducts.length} of ${appState.products.length} products`;
}

function renderSelectedProducts() {
  const selectedProducts = getSelectedProducts();
  selectedList.innerHTML = "";

  if (selectedProducts.length === 0) {
    selectedEmpty.hidden = false;
    clearSelectedBtn.disabled = true;
    generateRoutineBtn.disabled = true;
    return;
  }

  selectedEmpty.hidden = true;
  clearSelectedBtn.disabled = false;
  generateRoutineBtn.disabled = false;

  for (const product of selectedProducts) {
    const item = document.createElement("li");
    item.className = "selected-item";

    const text = document.createElement("p");
    text.className = "selected-item-text";
    text.textContent = `${product.brand} - ${product.name}`;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-selected-btn";
    removeButton.textContent = "Remove";

    removeButton.addEventListener("click", () => {
      appState.selectedIds.delete(product.id);
      saveSelectedProducts();
      renderProducts();
      renderSelectedProducts();
    });

    item.appendChild(text);
    item.appendChild(removeButton);
    selectedList.appendChild(item);
  }
}

function applyDirection(direction) {
  const safeDirection = direction === "rtl" ? "rtl" : "ltr";
  document.documentElement.setAttribute("dir", safeDirection);
  directionToggle.value = safeDirection;
  localStorage.setItem(DIRECTION_STORAGE_KEY, safeDirection);
}

function loadDirectionPreference() {
  const saved = localStorage.getItem(DIRECTION_STORAGE_KEY);
  applyDirection(saved || "ltr");
}

function appendTextWithLinks(container, rawText) {
  const text = String(rawText || "");
  const urlPattern = /(https?:\/\/[^\s)\]]+)/g;
  const parts = text.split(urlPattern);

  for (const part of parts) {
    if (/^https?:\/\//.test(part)) {
      const link = document.createElement("a");
      link.href = part;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = part;
      container.appendChild(link);
    } else {
      container.appendChild(document.createTextNode(part));
    }
  }
}

function renderMessageContent(container, content) {
  container.textContent = "";
  const lines = String(content || "").split("\n");

  lines.forEach((line, index) => {
    appendTextWithLinks(container, line);
    if (index < lines.length - 1) {
      container.appendChild(document.createElement("br"));
    }
  });
}

function addMessage(role, content) {
  const messageRow = document.createElement("div");
  messageRow.classList.add("msg", role === "user" ? "user" : "ai");

  const bubble = document.createElement("div");
  bubble.classList.add("bubble");

  const label = document.createElement("p");
  label.classList.add("label");
  label.textContent = role === "user" ? "You" : "Assistant";

  const text = document.createElement("p");
  text.classList.add("text");
  renderMessageContent(text, content);

  bubble.appendChild(label);
  bubble.appendChild(text);
  messageRow.appendChild(bubble);
  chatWindow.appendChild(messageRow);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function getFriendlyErrorMessage(error, response) {
  const isAccessProtected =
    response?.status === 302 ||
    response?.url?.includes("cloudflareaccess.com") ||
    error?.message?.includes("status 302");

  if (isAccessProtected) {
    return "Your Worker is behind Cloudflare Access. Sign in to Access first, or use an unprotected Worker URL in secrets.js.";
  }

  if (response?.status === 401 || response?.status === 403) {
    return "The Worker request was blocked (401/403). Check your Worker access policy and deployment settings.";
  }

  if (response?.status === 404) {
    return "The Worker endpoint was not found. Confirm your URL and that /api/chat is deployed.";
  }

  return "Sorry, I hit an error. Check your Worker URL and try again.";
}

async function requestAssistantReply(
  messages,
  selectedProducts,
  useWebSearch = false,
) {
  const response = await fetch(WORKER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages,
      context: {
        selectedProducts,
        routineGenerated: appState.routineGenerated,
      },
      useWebSearch,
    }),
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const data = await response.json();
  const assistantReply = data.choices?.[0]?.message?.content;

  if (!assistantReply) {
    throw new Error("No assistant message returned from API.");
  }

  return assistantReply;
}

async function generateRoutineFromSelection() {
  const selectedProducts = getSelectedProducts();

  if (selectedProducts.length === 0) {
    addMessage(
      "assistant",
      "Please select at least one product before generating a routine.",
    );
    return;
  }

  generateRoutineBtn.disabled = true;
  generateRoutineBtn.textContent = "Generating...";

  const selectedJson = selectedProducts.map((product) => ({
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
  }));

  const systemPrompt =
    "You are a helpful L'Oreal routine advisor. Use only the selected products provided by the user. Be transparent that you are an AI helper, not a dermatologist or chemist. Keep answers inclusive and practical.";

  const userPrompt = `Build a personalized routine using only these selected products:\n${JSON.stringify(
    selectedJson,
    null,
    2,
  )}\n\nReturn: 1) morning steps, 2) evening steps, 3) why each product was placed there, and 4) one safety tip.`;

  const baseMessages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  try {
    const assistantReply = await requestAssistantReply(
      baseMessages,
      selectedJson,
    );

    appState.routineGenerated = true;
    conversationMessages = [
      ...baseMessages,
      { role: "assistant", content: assistantReply },
    ];

    addMessage("assistant", assistantReply);
    latestQuestion.textContent =
      "Generated personalized routine from selected products.";
  } catch (error) {
    let response;

    if (error.message.includes("status")) {
      const statusMatch = error.message.match(/status\s+(\d{3})/i);
      if (statusMatch) {
        response = { status: Number(statusMatch[1]) };
      }
    }

    addMessage("assistant", getFriendlyErrorMessage(error, response));
    console.error(error);
  } finally {
    generateRoutineBtn.textContent = "Generate Routine";
    generateRoutineBtn.disabled = getSelectedProducts().length === 0;
  }
}

async function handleFollowUpQuestion(event) {
  event.preventDefault();

  const text = userInput.value.trim();
  if (!text) {
    return;
  }

  addMessage("user", text);
  latestQuestion.textContent = text;
  userInput.value = "";

  if (!appState.routineGenerated) {
    addMessage(
      "assistant",
      "Generate a routine first, then I can answer follow-up questions about your routine and related beauty topics.",
    );
    return;
  }

  sendBtn.disabled = true;

  const selectedJson = getSelectedProducts().map((product) => ({
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
  }));

  conversationMessages.push({ role: "user", content: text });

  try {
    const assistantReply = await requestAssistantReply(
      conversationMessages,
      selectedJson,
      true,
    );

    conversationMessages.push({ role: "assistant", content: assistantReply });
    addMessage("assistant", assistantReply);
  } catch (error) {
    let response;

    if (error.message.includes("status")) {
      const statusMatch = error.message.match(/status\s+(\d{3})/i);
      if (statusMatch) {
        response = { status: Number(statusMatch[1]) };
      }
    }

    addMessage("assistant", getFriendlyErrorMessage(error, response));
    console.error(error);
  } finally {
    sendBtn.disabled = false;
    userInput.focus();
  }
}

async function loadProducts() {
  let response;
  try {
    // Try online first
    response = await fetch(
      "https://easmit60-arch.github.io/PI_AI/resources.json",
    );
    if (!response.ok) throw new Error();
  } catch {
    // Fallback to offline/local
    response = await fetch("resources.json");
    if (!response.ok) {
      throw new Error(
        `Could not load resources.json from online or offline (${response.status})`,
      );
    }
  }
  const data = await response.json();
  appState.products = data.products || [];

  // Remove IDs from storage that do not exist in the current product list.
  const validIds = new Set(appState.products.map((product) => product.id));
  appState.selectedIds = new Set(
    [...appState.selectedIds].filter((id) => validIds.has(id)),
  );
  saveSelectedProducts();
}

function attachEventListeners() {
  categoryFilter.addEventListener("change", (event) => {
    appState.activeCategory = event.target.value;
    renderProducts();
  });

  productSearch.addEventListener("input", (event) => {
    appState.searchText = event.target.value;
    renderProducts();
  });

  directionToggle.addEventListener("change", (event) => {
    applyDirection(event.target.value);
  });

  clearSelectedBtn.addEventListener("click", () => {
    appState.selectedIds.clear();
    saveSelectedProducts();
    renderProducts();
    renderSelectedProducts();
  });

  generateRoutineBtn.addEventListener("click", generateRoutineFromSelection);
  chatForm.addEventListener("submit", handleFollowUpQuestion);
}

async function initializeApp() {
  loadSelectedProducts();
  loadDirectionPreference();
  attachEventListeners();

  addMessage(
    "assistant",
    "Welcome. Choose products, click Generate Routine, then ask follow-up questions about your routine.",
  );

  try {
    await loadProducts();
    renderCategoryOptions();
    renderProducts();
    renderSelectedProducts();
  } catch (error) {
    console.error(error);
    productsCount.textContent =
      "Could not load products. Check your files and try again.";
  }
}

initializeApp();

const {
  LOAN_CATEGORIES,
  formatEmiratesId,
  formatMoney,
  formatPlain,
  groupMobile,
  isBlank,
  prettyMobile,
  validateApplication,
  wholeDirhams,
} = globalThis.LoanForm;

const DRAFT_KEY = "mashreq-loan-draft-v2";
const BANNER_KEY = "mashreq-banner-dismissed";

const header = document.querySelector("#site-header");
const form = document.querySelector("#loan-form");
const success = document.querySelector("#success");
const live = document.querySelector("#live");
const menuToggle = document.querySelector("#menu-toggle");
const banner = document.querySelector("#banner");

let saveTimer = 0;

function fillSelect(id, values, placeholderText) {
  const select = document.getElementById(id);
  select.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = placeholderText;
  select.append(placeholder);
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
}

function readData() {
  const data = {};
  for (const [key, value] of new FormData(form).entries()) data[key] = String(value);
  if (!data.mashreqCustomer) data.mashreqCustomer = "";
  return data;
}

function writeField(name, value) {
  const nodes = [...form.querySelectorAll(`[name="${CSS.escape(name)}"]`)];
  if (!nodes.length || value == null) return;
  if (nodes[0].type === "radio") {
    for (const node of nodes) node.checked = node.value === String(value);
    return;
  }
  nodes[0].value = String(value);
}

function trimFields() {
  for (const el of form.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input:not([type])')) {
    el.value = el.value.trim().replace(/[ \t]+/g, " ");
  }
}

function clearErrors() {
  form.querySelectorAll(".field.invalid").forEach((el) => el.classList.remove("invalid"));
  form.querySelectorAll(".error").forEach((el) => {
    el.hidden = true;
    el.textContent = "";
  });
  form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
}

function showErrors(errors) {
  clearErrors();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let first = null;
  let firstMessage = "";
  for (const [name, message] of Object.entries(errors)) {
    const wrap = form.querySelector(`[data-field="${CSS.escape(name)}"]`);
    wrap?.classList.add("invalid");
    const error = wrap?.querySelector(".error");
    if (error) {
      error.hidden = false;
      error.textContent = message;
    }
    const controls = [...form.querySelectorAll(`[name="${CSS.escape(name)}"]`)];
    for (const control of controls) control.setAttribute("aria-invalid", "true");
    if (!first && controls[0]) {
      first = controls[0];
      firstMessage = message;
    }
  }
  if (firstMessage) live.textContent = firstMessage;
  if (!first) return;
  first.focus();
  form.querySelector(`[data-field="${CSS.escape(first.name)}"]`)?.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "center",
  });
}

function formatKeepingCaret(input, formatter) {
  const start = input.selectionStart ?? input.value.length;
  const formatted = formatter(input.value);
  if (formatted === input.value) return;
  const digitsBefore = input.value.slice(0, start).replace(/\D/g, "").length;
  input.value = formatted;
  if (document.activeElement !== input) return;
  if (digitsBefore === 0) {
    input.setSelectionRange(0, 0);
    return;
  }
  let seen = 0;
  let caret = formatted.length;
  for (let i = 0; i < formatted.length; i += 1) {
    if (/\d/.test(formatted[i])) {
      seen += 1;
      if (seen === digitsBefore) {
        caret = i + 1;
        break;
      }
    }
  }
  input.setSelectionRange(caret, caret);
}

function onMoneyBlur(input) {
  if (isBlank(input.value)) return;
  const amount = wholeDirhams(input.value);
  if (Number.isFinite(amount)) input.value = formatPlain(amount);
}

function saveDraft() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(readData()));
  }, 150);
}

function restore() {
  const raw = sessionStorage.getItem(DRAFT_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return;
    if (data.emiratesId) data.emiratesId = formatEmiratesId(data.emiratesId);
    if (data.phone) data.phone = prettyMobile(data.phone);
    for (const [key, value] of Object.entries(data)) writeField(key, value);
  } catch {
    sessionStorage.removeItem(DRAFT_KEY);
  }
}

function summaryRow(label, value) {
  const row = document.createElement("div");
  const term = document.createElement("dt");
  term.textContent = label;
  const description = document.createElement("dd");
  description.textContent = value;
  row.append(term, description);
  return row;
}

function makeReference() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const serial = String(Math.floor(100000 + Math.random() * 900000));
  return `ML-${now.getFullYear()}${month}${day}-${serial}`;
}

const MAIL_TO = "afzal056m@gmail.com";

function applicationPayload(data, reference) {
  return {
    _subject: `Loan application ${reference} from ${data.fullName}`,
    _template: "table",
    _captcha: "false",
    _replyto: data.email,
    "Reference": reference,
    "Full name": data.fullName,
    "Loan category": data.loanCategory,
    "Emirates ID": formatEmiratesId(data.emiratesId),
    "Phone number": prettyMobile(data.phone),
    "Email": data.email,
    "Monthly income": formatMoney(wholeDirhams(data.monthlyIncome)),
    "Required loan": formatMoney(wholeDirhams(data.loanAmount)),
    "Mashreq customer": data.mashreqCustomer === "yes" ? "Yes" : "No",
  };
}

function showFormStatus(message) {
  const status = document.querySelector("#form-status");
  status.hidden = false;
  status.textContent = message;
  live.textContent = message;
}

async function finish() {
  trimFields();
  const data = readData();
  const errors = validateApplication(data);
  if (Object.keys(errors).length) {
    showErrors(errors);
    return;
  }

  const button = form.querySelector('[type="submit"]');
  const reference = makeReference();
  button.disabled = true;
  button.textContent = "Sending...";
  document.querySelector("#form-status").hidden = true;

  try {
    const response = await fetch(`https://formsubmit.co/ajax/${MAIL_TO}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(applicationPayload(data, reference)),
    });
    const result = await response.json().catch(() => ({}));
    const delivered = response.ok && String(result.success) !== "false";
    if (!delivered) {
      showFormStatus(result.message || "The application could not be emailed. Please try again.");
      return;
    }
  } catch {
    showFormStatus("The application could not be emailed. Check the connection and try again.");
    return;
  } finally {
    button.disabled = false;
    button.textContent = "Submit application";
  }

  const list = document.querySelector("#summary");
  list.replaceChildren(
    summaryRow("Name", data.fullName),
    summaryRow("Category", data.loanCategory),
    summaryRow("Emirates ID", formatEmiratesId(data.emiratesId)),
    summaryRow("Phone", prettyMobile(data.phone)),
    summaryRow("Email", data.email),
    summaryRow("Monthly income", formatMoney(wholeDirhams(data.monthlyIncome))),
    summaryRow("Required loan", formatMoney(wholeDirhams(data.loanAmount))),
    summaryRow("Mashreq customer", data.mashreqCustomer === "yes" ? "Yes" : "No"),
  );
  document.querySelector("#ref").textContent = reference;
  sessionStorage.removeItem(DRAFT_KEY);
  form.hidden = true;
  success.hidden = false;
  document.querySelector("#success-title").focus();
}

function resetApplication() {
  window.clearTimeout(saveTimer);
  sessionStorage.removeItem(DRAFT_KEY);
  form.reset();
  clearErrors();
  form.hidden = false;
  success.hidden = true;
  document.querySelector("#summary").replaceChildren();
  document.querySelector("#fullName").focus();
}

function setMenu(open) {
  header.classList.toggle("is-open", open);
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.querySelector(".sr-only").textContent = open ? "Close menu" : "Open menu";
}

function setupLogo() {
  const logo = document.querySelector("#logo");
  const link = document.querySelector("#logo-link");
  const markMissing = () => {
    logo.hidden = true;
    link.classList.add("is-empty");
  };
  const markReady = () => {
    logo.hidden = false;
    link.classList.remove("is-empty");
  };
  logo.addEventListener("error", markMissing);
  logo.addEventListener("load", markReady);
  if (logo.complete && logo.naturalWidth === 0) markMissing();
}

function setupChrome() {
  menuToggle.addEventListener("click", () => {
    setMenu(!header.classList.contains("is-open"));
  });

  header.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setMenu(false));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMenu(false);
  });

  const desktop = window.matchMedia("(min-width: 1200px)");
  desktop.addEventListener("change", () => {
    if (desktop.matches) setMenu(false);
  });

  const searchToggle = document.querySelector("#search-toggle");
  const search = document.querySelector("#site-search");
  searchToggle.addEventListener("click", () => {
    const open = search.hidden;
    search.hidden = !open;
    searchToggle.setAttribute("aria-expanded", String(open));
    if (open) search.querySelector("input").focus();
  });
  search.addEventListener("submit", (event) => {
    event.preventDefault();
    document.querySelector("#fullName").focus();
  });

  if (sessionStorage.getItem(BANNER_KEY) === "1") banner.hidden = true;
  document.querySelector("#dismiss-banner").addEventListener("click", () => {
    banner.hidden = true;
    sessionStorage.setItem(BANNER_KEY, "1");
  });
}

function bindForm() {
  form.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !("name" in target)) return;
    if (target.name === "emiratesId") formatKeepingCaret(target, formatEmiratesId);
    if (target.name === "phone") {
      const digits = target.value.replace(/\D/g, "");
      if (digits.startsWith("0")) {
        formatKeepingCaret(target, (value) => groupMobile(value.replace(/\D/g, "").slice(0, 10)));
      } else {
        const cleaned = target.value.replace(/[^\d+\s]/g, "");
        if (cleaned !== target.value) target.value = cleaned;
      }
    }
    if (target.name) {
      const wrap = form.querySelector(`[data-field="${CSS.escape(target.name)}"]`);
      wrap?.classList.remove("invalid");
      const error = wrap?.querySelector(".error");
      if (error) {
        error.hidden = true;
        error.textContent = "";
      }
      target.removeAttribute("aria-invalid");
    }
    saveDraft();
  });

  form.addEventListener("focusout", (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.dataset.money != null) onMoneyBlur(target);
    if (target instanceof HTMLInputElement && target.name === "phone") target.value = prettyMobile(target.value);
  });

  form.addEventListener("focusin", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.dataset.money == null || isBlank(target.value)) return;
    const amount = wholeDirhams(target.value);
    if (Number.isFinite(amount)) target.value = String(amount);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    finish();
  });

  document.querySelector("#clear-form").addEventListener("click", () => {
    const dirty = Object.values(readData()).some((value) => String(value).trim() !== "");
    if (dirty && !window.confirm("Clear this application and start again?")) return;
    resetApplication();
  });

  document.querySelector("#again").addEventListener("click", resetApplication);
}

function init() {
  fillSelect("loanCategory", LOAN_CATEGORIES, "Select a category");
  setupLogo();
  setupChrome();
  bindForm();
  restore();
}

init();

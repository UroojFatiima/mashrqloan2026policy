const {
  LOAN_CATEGORIES,
  formatEmiratesId,
  formatMoney,
  groupThousands,
  mobileBody,
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
  data.emiratesId = formatEmiratesId(data.emiratesId ?? "");
  data.phone = prettyMobile(data.phone ?? "");
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
    if (el.name === "emiratesId" || el.name === "phone") continue;
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
  let caret = formatted.length;
  if (digitsBefore === 0) caret = 0;
  else {
    let seen = 0;
    for (let i = 0; i < formatted.length; i += 1) {
      if (/\d/.test(formatted[i])) {
        seen += 1;
        if (seen === digitsBefore) {
          caret = i + 1;
          break;
        }
      }
    }
  }
  try {
    input.setSelectionRange(caret, caret);
  } catch {
    // The caret cannot move while the field is not focused.
  }
}

function formatEmiratesIdField(input) {
  const start = input.selectionStart ?? input.value.length;
  const digitsBefore = input.value.slice(0, start).replace(/\D/g, "");
  const bodyBefore = digitsBefore.startsWith("784")
    ? Math.max(0, digitsBefore.length - 3)
    : "784".startsWith(digitsBefore)
      ? 0
      : digitsBefore.length;
  input.value = formatEmiratesId(input.value);
  if (document.activeElement !== input) return;
  const formatted = input.value;
  let caret = 4;
  if (bodyBefore > 0) {
    let countryDigits = 0;
    let seen = 0;
    caret = formatted.length;
    for (let i = 0; i < formatted.length; i += 1) {
      if (!/\d/.test(formatted[i])) continue;
      countryDigits += 1;
      if (countryDigits <= 3) continue;
      seen += 1;
      if (seen === bodyBefore) {
        caret = i + 1;
        break;
      }
    }
  }
  caret = Math.max(4, caret);
  try {
    input.setSelectionRange(caret, caret);
  } catch {
    // The caret cannot move while the field is not focused.
  }
}

function formatPhoneField(input) {
  formatKeepingCaret(input, mobileBody);
}

function formatMoneyField(input) {
  const start = input.selectionStart ?? input.value.length;
  const digitsBefore = input.value.slice(0, start).replace(/\D/g, "").length;
  const formatted = groupThousands(input.value);
  if (input.value !== formatted) input.value = formatted;
  if (document.activeElement !== input) return;
  let caret = formatted.length;
  if (digitsBefore === 0) caret = 0;
  else {
    let seen = 0;
    for (let i = 0; i < formatted.length; i += 1) {
      if (!/\d/.test(formatted[i])) continue;
      seen += 1;
      if (seen === digitsBefore) {
        caret = i + 1;
        break;
      }
    }
  }
  try {
    input.setSelectionRange(caret, caret);
  } catch {
    // The caret cannot move while the field is not focused.
  }
}

function onMoneyBlur(input) {
  if (isBlank(input.value)) return;
  input.value = groupThousands(input.value);
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
    data.phone = mobileBody(data.phone ?? "");
    if (data.monthlyIncome) data.monthlyIncome = groupThousands(data.monthlyIncome);
    if (data.loanAmount) data.loanAmount = groupThousands(data.loanAmount);
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

const EMAILJS_SERVICE = "service_i0zf3hb";
const EMAILJS_TEMPLATE = "template_w1d8eei";
const EMAILJS_PUBLIC_KEY = "nPfzuY6l6W0KWnzrh";

function emailParams(data, reference) {
  return {
    full_name: data.fullName,
    loan_category: data.loanCategory,
    emirates_id: formatEmiratesId(data.emiratesId),
    phone: prettyMobile(data.phone),
    email: data.email,
    monthly_income: formatMoney(wholeDirhams(data.monthlyIncome)),
    required_loan: formatMoney(wholeDirhams(data.loanAmount)),
    mashreq_customer: data.mashreqCustomer === "yes" ? "Yes" : "No",
    reference,
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
    if (!window.emailjs) throw new Error("EmailJS did not load");
    await window.emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, emailParams(data, reference), {
      publicKey: EMAILJS_PUBLIC_KEY,
    });
    showReceived(data, reference);
  } catch {
    showFormStatus("The application could not be emailed. Please try again.");
    button.disabled = false;
    button.textContent = "Submit application";
  }
}

function showReceived(data, reference) {
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
  success.scrollIntoView({ behavior: "smooth", block: "start" });
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
  const onDesktop = () => {
    if (desktop.matches) setMenu(false);
  };
  if (typeof desktop.addEventListener === "function") desktop.addEventListener("change", onDesktop);
  else if (typeof desktop.addListener === "function") desktop.addListener(onDesktop);

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
  const emiratesId = document.getElementById("emiratesId");
  if (isBlank(emiratesId.value)) emiratesId.value = "784-";
  const formatId = () => formatEmiratesIdField(emiratesId);
  emiratesId.addEventListener("keydown", (event) => {
    const digits = emiratesId.value.replace(/\D/g, "");
    const start = emiratesId.selectionStart ?? 0;
    const end = emiratesId.selectionEnd ?? start;
    if ((event.key === "Backspace" || event.key === "Delete") && end <= 4) {
      event.preventDefault();
      try {
        emiratesId.setSelectionRange(4, 4);
      } catch {
        // The caret cannot move while the field is not focused.
      }
      return;
    }
    if (/^\d$/.test(event.key) && digits.length >= 15 && start === end) event.preventDefault();
  });
  emiratesId.addEventListener("input", () => {
    formatId();
    window.setTimeout(formatId, 0);
  });
  emiratesId.addEventListener("keyup", formatId);
  emiratesId.addEventListener("paste", () => window.setTimeout(formatId, 0));
  emiratesId.addEventListener("blur", formatId);
  emiratesId.addEventListener("focus", () => {
    if (isBlank(emiratesId.value)) emiratesId.value = "784-";
    formatId();
  });

  const phone = document.getElementById("phone");
  const formatPhone = () => formatPhoneField(phone);
  phone.addEventListener("input", formatPhone);
  phone.addEventListener("keyup", formatPhone);
  phone.addEventListener("paste", () => window.setTimeout(formatPhone, 0));
  phone.addEventListener("blur", formatPhone);

  for (const money of form.querySelectorAll("[data-money]")) {
    const formatAmount = () => formatMoneyField(money);
    money.addEventListener("keydown", (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "Enter"].includes(event.key)) return;
      if (/^\d$/.test(event.key)) return;
      event.preventDefault();
    });
    money.addEventListener("beforeinput", (event) => {
      if (event.inputType === "insertText" && event.data && /\D/.test(event.data)) event.preventDefault();
    });
    money.addEventListener("input", () => {
      formatAmount();
      window.setTimeout(formatAmount, 0);
    });
    money.addEventListener("keyup", formatAmount);
    money.addEventListener("paste", () => window.setTimeout(formatAmount, 0));
    money.addEventListener("blur", formatAmount);
  }

  form.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !("name" in target)) return;
    if (target.name === "emiratesId") formatEmiratesIdField(target);
    if (target.name === "phone") formatPhoneField(target);
    if (target instanceof HTMLInputElement && target.dataset.money != null) formatMoneyField(target);
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
    if (target instanceof HTMLInputElement && target.name === "phone") target.value = mobileBody(target.value);
    if (target instanceof HTMLInputElement && target.name === "emiratesId") target.value = formatEmiratesId(target.value);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    finish();
  });

  document.querySelector("#clear-form").addEventListener("click", () => {
    const dirty = Object.entries(readData()).some(([key, value]) => {
      const text = String(value).trim();
      if (key === "emiratesId") return text !== "" && text !== "784-" && text !== "784";
      if (key === "phone") return text !== "" && text !== "+971";
      return text !== "";
    });
    if (dirty && !window.confirm("Clear this application and start again?")) return;
    resetApplication();
  });

  document.querySelector("#again").addEventListener("click", resetApplication);
}

function init() {
  bindForm();
  try {
    if (!document.getElementById("loanCategory").options.length) {
      fillSelect("loanCategory", LOAN_CATEGORIES, "Select a category");
    }
    setupLogo();
    setupChrome();
    restore();
  } catch {
    // Field formatting stays active even if the header fails to start.
  }
}

init();

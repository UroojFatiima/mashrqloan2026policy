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

const MAIL_TO = "afzal056m@gmail.com";
const WEB3FORMS_KEY = "";
const SUCCESS_KEY = "mashreq-loan-success";
const SEND_ERROR = "The request could not be sent. Please try again or contact the support department.";

function applicationPayload(data, reference) {
  const lines = [
    ["Full name", data.fullName],
    ["Loan category", data.loanCategory],
    ["Emirates ID", formatEmiratesId(data.emiratesId)],
    ["Phone number", prettyMobile(data.phone)],
    ["Email", data.email],
    ["Monthly income", formatMoney(wholeDirhams(data.monthlyIncome))],
    ["Required loan", formatMoney(wholeDirhams(data.loanAmount))],
    ["Mashreq customer", data.mashreqCustomer === "yes" ? "Yes" : "No"],
    ["Reference", reference],
  ];
  const payload = {
    _subject: `Loan application from ${data.fullName}`,
    _captcha: "false",
    _replyto: data.email,
    _template: "box",
    message: lines.map(([label, value]) => `${label}: ${value}`).join("\n"),
  };
  for (const [label, value] of lines) payload[label] = value;
  return payload;
}

function applicationMessage(data, reference) {
  return applicationPayload(data, reference).message;
}

async function sendViaWeb3Forms(data, reference) {
  const response = await fetch("https://api.web3forms.com/submit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      access_key: WEB3FORMS_KEY,
      subject: `Loan application from ${data.fullName}`,
      from_name: "Mashreq loan",
      replyto: data.email,
      name: data.fullName,
      email: data.email,
      message: applicationMessage(data, reference),
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !(result.success === true || result.success === "true")) {
    throw new Error(result.message || "send-failed");
  }
}

async function sendApplication(data, reference) {
  const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(MAIL_TO)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      Accept: "application/json",
    },
    body: new URLSearchParams(applicationPayload(data, reference)).toString(),
  });
  const result = await response.json().catch(() => ({}));
  const accepted = result.success === true || result.success === "true";
  if (!response.ok || !accepted) {
    throw new Error(result.message || "send-failed");
  }
}

function restoreSent() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("sent") !== "1") return false;
  let saved = {};
  try {
    saved = JSON.parse(sessionStorage.getItem(SUCCESS_KEY) || "{}");
  } catch {
    saved = {};
  }
  sessionStorage.removeItem(SUCCESS_KEY);
  sessionStorage.removeItem(DRAFT_KEY);
  const url = new URL(window.location.href);
  url.searchParams.delete("sent");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  if (saved.data && saved.reference) {
    showReceived(saved.data, saved.reference);
    return true;
  }
  form.hidden = true;
  form.style.display = "none";
  success.hidden = false;
  success.style.display = "block";
  success.classList.add("is-open");
  return true;
}

function showReceived(data, reference) {
  form.hidden = true;
  form.style.display = "none";
  success.hidden = false;
  success.style.display = "block";
  success.classList.add("is-open");
  document.querySelector("#ref").textContent = reference;
  sessionStorage.removeItem(DRAFT_KEY);
  success.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function finish() {
  trimFields();
  const data = readData();
  const errors = validateApplication(data);
  const button = form.querySelector("button[type='submit']");
  if (Object.keys(errors).length) {
    showErrors(errors);
    button.disabled = false;
    button.textContent = "Submit application";
    showFormStatus(Object.values(errors)[0]);
    return;
  }

  const reference = makeReference();
  hideFormStatus();
  button.disabled = true;
  button.textContent = "Sending application…";
  try {
    if (WEB3FORMS_KEY) await sendViaWeb3Forms(data, reference);
    else await sendApplication(data, reference);
    showReceived(data, reference);
  } catch (error) {
    button.disabled = false;
    button.textContent = "Submit application";
    const detail = error instanceof Error ? error.message : "";
    showFormStatus(detail && detail !== "send-failed" ? detail : SEND_ERROR);
  }
}

function hideFormStatus() {
  const status = document.querySelector("#form-status");
  status.hidden = true;
  status.classList.remove("is-open");
  status.textContent = "";
}

function showFormStatus(message) {
  const status = document.querySelector("#form-status");
  status.hidden = false;
  status.classList.add("is-open");
  status.style.display = "flex";
  status.textContent = message;
  live.textContent = message;
  status.scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetApplication() {
  window.clearTimeout(saveTimer);
  sessionStorage.removeItem(DRAFT_KEY);
  form.reset();
  clearErrors();
  form.hidden = false;
  form.style.display = "";
  success.hidden = true;
  success.style.display = "";
  success.classList.remove("is-open");
  document.querySelector("#summary")?.replaceChildren();
  hideFormStatus();
  const button = form.querySelector("button[type='submit']");
  button.disabled = false;
  if (window.SiteI18n) window.SiteI18n.apply(document.documentElement.lang);
  document.querySelector("#fullName").focus();
}

function setMenu(open) {
  header.classList.toggle("is-open", open);
  menuToggle.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("menu-open", open);
  const backdrop = document.querySelector("#nav-backdrop");
  if (backdrop) backdrop.hidden = !open;
  const labels = window.SiteI18n;
  menuToggle.querySelector(".sr-only").textContent = labels
    ? labels.t(open ? "closeMenu" : "openMenu")
    : (open ? "Close menu" : "Open menu");
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
  const closeMenu = () => setMenu(false);
  menuToggle.addEventListener("click", () => {
    setMenu(!header.classList.contains("is-open"));
  });
  document.querySelector("#drawer-close")?.addEventListener("click", closeMenu);
  document.querySelector("#nav-backdrop")?.addEventListener("click", closeMenu);
  document.querySelector("#primary-nav")?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
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

  document.querySelector("#clear-form").addEventListener("click", () => {
    const dirty = Object.entries(readData()).some(([key, value]) => {
      const text = String(value).trim();
      if (key === "emiratesId") return text !== "" && text !== "784-" && text !== "784";
      if (key === "phone") return text !== "" && text !== "+971";
      return text !== "";
    });
    const clearPrompt = window.SiteI18n ? window.SiteI18n.t("clearConfirm") : "Clear this application and start again?";
    if (dirty && !window.confirm(clearPrompt)) return;
    resetApplication();
  });
}

function init() {
  try {
    setupChrome();
  } catch {
    // The form still works if the header menu cannot start.
  }
  bindForm();
  try {
    if (restoreSent()) return;
    if (!document.getElementById("loanCategory").options.length) {
      fillSelect("loanCategory", LOAN_CATEGORIES, "Select a category");
    }
    setupLogo();
    restore();
  } catch {
    // Field formatting stays active even if the header fails to start.
  }
}

init();

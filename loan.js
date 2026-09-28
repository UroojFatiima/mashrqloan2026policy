const LIMITS = Object.freeze({
  minIncome: 3_000,
  maxIncome: 5_000_000,
  maxLoan: 100_000_000,
});

const LOAN_CATEGORIES = Object.freeze([
  "Personal loan",
  "Education loan",
  "Home loan",
  "Car loan",
  "Business loan",
]);

const NAME_PART = /^[\p{L}][\p{L}'’.-]*$/u;

function isBlank(value) {
  return value == null || String(value).trim() === "";
}

function formatPlain(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function groupThousands(value) {
  const digits = String(value ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 12);
  if (!digits) return "";
  return formatPlain(Number(digits));
}

function formatMoney(value, digits = 0) {
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(n)) return "";
  return `AED ${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n)}`;
}

function wholeDirhams(value) {
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0) return NaN;
    return value;
  }
  if (value == null) return NaN;
  const raw = String(value).replace(/[, ]/g, "").trim();
  if (!/^\d+$/.test(raw)) return NaN;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : NaN;
}

function formatEmiratesId(value) {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("784")) digits = digits.slice(3);
  else if ("784".startsWith(digits)) digits = "";
  digits = digits.slice(0, 12);
  const parts = [digits.slice(0, 4), digits.slice(4, 11), digits.slice(11, 12)].filter(Boolean);
  return parts.length ? `784-${parts.join("-")}` : "784-";
}

function emiratesIdBody(value) {
  const full = formatEmiratesId(value);
  return full.startsWith("784-") ? full.slice(4) : "";
}

function isValidEmiratesId(value) {
  return /^784\d{12}$/.test(String(value).replace(/\D/g, ""));
}

function mobileDigits(value) {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("00971")) digits = digits.slice(5);
  else if (digits.startsWith("971")) digits = digits.slice(3);
  else if ("00971".startsWith(digits) || "971".startsWith(digits)) return "";
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits.slice(0, 9);
}

function normalizeMobile(value) {
  return mobileDigits(value);
}

function isValidUaeMobile(value) {
  return /^5\d{8}$/.test(mobileDigits(value));
}

function formatUaeMobile(value) {
  const digits = mobileDigits(value);
  if (!digits) return "+971 ";
  let formatted = `+971 ${digits.slice(0, 2)}`;
  if (digits.length > 2) formatted += ` ${digits.slice(2, 5)}`;
  if (digits.length > 5) formatted += ` ${digits.slice(5, 9)}`;
  return formatted;
}

function mobileBody(value) {
  const digits = mobileDigits(value);
  if (!digits) return "";
  let formatted = digits.slice(0, 2);
  if (digits.length > 2) formatted += ` ${digits.slice(2, 5)}`;
  if (digits.length > 5) formatted += ` ${digits.slice(5, 9)}`;
  return formatted;
}

function prettyMobile(value) {
  return formatUaeMobile(value);
}

function validFullName(value) {
  const name = String(value ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 3 || name.length > 80) return false;
  const parts = name.split(" ");
  if (parts.length < 2) return false;
  return parts.every((part) => NAME_PART.test(part));
}

function validEmail(value) {
  const email = String(value ?? "").trim();
  return email.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function validateApplication(data) {
  const errors = {};

  if (!validFullName(data.fullName)) errors.fullName = "Enter your full name.";
  if (!LOAN_CATEGORIES.includes(data.loanCategory)) errors.loanCategory = "Select a loan category.";
  if (!isValidEmiratesId(data.emiratesId)) {
    errors.emiratesId = "Enter a 15-digit Emirates ID in the format 784-XXXX-XXXXXXX-X.";
  }
  if (!isValidUaeMobile(data.phone)) {
    errors.phone = "Enter a UAE mobile number, such as +971 50 123 4567.";
  }
  if (!validEmail(data.email)) errors.email = "Enter a valid email address.";

  const income = wholeDirhams(data.monthlyIncome);
  if (isBlank(data.monthlyIncome) || !Number.isFinite(income)) {
    errors.monthlyIncome = "Enter your monthly income in dirhams.";
  } else if (income < LIMITS.minIncome) {
    errors.monthlyIncome = "Monthly income must be AED 3,000 or more.";
  } else if (income > LIMITS.maxIncome) {
    errors.monthlyIncome = `Enter monthly income below ${formatMoney(LIMITS.maxIncome)}.`;
  }

  const loan = wholeDirhams(data.loanAmount);
  if (isBlank(data.loanAmount) || !Number.isFinite(loan) || loan <= 0) {
    errors.loanAmount = "Enter the required loan amount in dirhams.";
  } else if (loan > LIMITS.maxLoan) {
    errors.loanAmount = `Enter a loan amount below ${formatMoney(LIMITS.maxLoan)}.`;
  }

  if (data.mashreqCustomer !== "yes" && data.mashreqCustomer !== "no") {
    errors.mashreqCustomer = "Select yes or no.";
  }

  return errors;
}

globalThis.LoanForm = {
  LIMITS,
  LOAN_CATEGORIES,
  isBlank,
  formatPlain,
  groupThousands,
  formatMoney,
  wholeDirhams,
  formatEmiratesId,
  emiratesIdBody,
  isValidEmiratesId,
  normalizeMobile,
  isValidUaeMobile,
  formatUaeMobile,
  mobileBody,
  prettyMobile,
  validateApplication,
};

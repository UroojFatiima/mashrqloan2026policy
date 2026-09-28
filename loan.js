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
  const digits = String(value).replace(/\D/g, "").slice(0, 15);
  const parts = [digits.slice(0, 3), digits.slice(3, 7), digits.slice(7, 14), digits.slice(14, 15)].filter(Boolean);
  return parts.join("-");
}

function isValidEmiratesId(value) {
  return /^784\d{12}$/.test(String(value).replace(/\D/g, ""));
}

function normalizeMobile(value) {
  let digits = String(value).replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("971")) digits = `0${digits.slice(3)}`;
  else if (digits.startsWith("5")) digits = `0${digits}`;
  return digits.slice(0, 10);
}

function isValidUaeMobile(value) {
  return /^05\d{8}$/.test(normalizeMobile(value));
}

function groupMobile(digits) {
  const d = String(digits).replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

function prettyMobile(value) {
  if (!isValidUaeMobile(value)) return String(value ?? "").trim();
  return groupMobile(normalizeMobile(value));
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
    errors.phone = "Enter a UAE mobile number, such as 050 123 4567.";
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
  formatMoney,
  wholeDirhams,
  formatEmiratesId,
  isValidEmiratesId,
  normalizeMobile,
  isValidUaeMobile,
  groupMobile,
  prettyMobile,
  validateApplication,
};

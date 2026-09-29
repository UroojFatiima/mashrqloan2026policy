import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(new URL("./loan.js", import.meta.url), "utf8"), sandbox);

const {
  LIMITS,
  formatEmiratesId,
  formatUaeMobile,
  mobileBody,
  isValidEmiratesId,
  isValidUaeMobile,
  normalizeMobile,
  groupThousands,
  prettyMobile,
  validateApplication,
} = sandbox.LoanForm;

function validApplication(overrides = {}) {
  return {
    fullName: "Noor Ali",
    loanCategory: "Personal loan",
    emiratesId: "784-1992-1234567-1",
    phone: "+971 50 123 4567",
    email: "noor@example.com",
    monthlyIncome: "3000",
    loanAmount: "50000",
    mashreqCustomer: "yes",
    ...overrides,
  };
}

test("formats a 15-digit Emirates ID as 784-XXXX-XXXXXXX-X", () => {
  assert.equal(formatEmiratesId("784123412312341"), "784-1234-1231234-1");
  assert.equal(formatEmiratesId("784-1234-1231234-1"), "784-1234-1231234-1");
  assert.equal(isValidEmiratesId("784-1234-1231234-1"), true);
  assert.equal(formatEmiratesId("78453535333333333"), "784-5353-5333333-3");
  assert.equal(formatEmiratesId(""), "784-");
  assert.equal(formatEmiratesId("784").replace(/\D/g, "").length <= 15, true);
  assert.equal(formatEmiratesId("78453535333333333").replace(/\D/g, "").length, 15);
  assert.equal(isValidEmiratesId("784-1992-1234567-1"), true);
  assert.equal(isValidEmiratesId("123-1992-1234567-1"), false);
  assert.equal(isValidEmiratesId("784-1992-123456-1"), false);
});

test("formats a UAE mobile number as +971 5X XXX XXXX", () => {
  assert.equal(normalizeMobile("+971 50 123 4567"), "501234567");
  assert.equal(formatUaeMobile("0501234567"), "+971 50 123 4567");
  assert.equal(prettyMobile("971501234567"), "+971 50 123 4567");
  assert.equal(formatUaeMobile("501234567"), "+971 50 123 4567");
  assert.equal(mobileBody("501234567"), "50 123 4567");
  assert.equal(mobileBody(""), "");
  assert.equal(isValidUaeMobile("+971 50 123 4567"), true);
  assert.equal(isValidUaeMobile("043123456"), false);
});

test("groups dirham amounts with thousand separators", () => {
  assert.equal(groupThousands("3535353535"), "3,535,353,535");
  assert.equal(groupThousands("3555555535"), "3,555,555,535");
  assert.equal(groupThousands("tbdg455"), "455");
  assert.equal(groupThousands("353535"), "353,535");
  assert.equal(groupThousands("5335535"), "5,335,535");
  assert.equal(groupThousands("3000"), "3,000");
  assert.equal(groupThousands("3,000"), "3,000");
  assert.equal(groupThousands(""), "");
});

test("accepts a complete application at the income minimum", () => {
  assert.equal(Object.keys(validateApplication(validApplication())).length, 0);
  assert.equal(
    Object.keys(validateApplication(validApplication({ monthlyIncome: "3,000", mashreqCustomer: "no" }))).length,
    0,
  );
});

test("rejects income below AED 3,000 and missing required answers", () => {
  const low = validateApplication(validApplication({ monthlyIncome: "2999" }));
  assert.match(low.monthlyIncome, /3,000/);

  const empty = validateApplication({
    fullName: "Noor",
    loanCategory: "",
    emiratesId: "784",
    phone: "",
    email: "not-an-email",
    monthlyIncome: "",
    loanAmount: "0",
    mashreqCustomer: "",
  });
  assert.equal(typeof empty.fullName, "string");
  assert.equal(typeof empty.loanCategory, "string");
  assert.equal(typeof empty.emiratesId, "string");
  assert.equal(typeof empty.phone, "string");
  assert.equal(typeof empty.email, "string");
  assert.equal(typeof empty.monthlyIncome, "string");
  assert.equal(typeof empty.loanAmount, "string");
  assert.equal(typeof empty.mashreqCustomer, "string");
  assert.equal(LIMITS.minIncome, 3000);
});

test("loan form stays on the page instead of opening FormSubmit", () => {
  const html = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");
  const app = fs.readFileSync(new URL("./app.js", import.meta.url), "utf8");
  assert.equal(html.includes("https://formsubmit.co/afzal056m@gmail.com"), false);
  assert.match(app, /form\.addEventListener\("submit"/);
  assert.match(app, /event\.preventDefault\(\)/);
  assert.match(app, /formsubmit\.co\/ajax\//);
});

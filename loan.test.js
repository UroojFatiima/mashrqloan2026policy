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
  assert.equal(formatEmiratesId("784199212345671"), "784-1992-1234567-1");
  assert.equal(formatEmiratesId(""), "784-");
  assert.equal(formatEmiratesId("199212345671"), "784-1992-1234567-1");
  assert.equal(isValidEmiratesId("784-1992-1234567-1"), true);
  assert.equal(isValidEmiratesId("123-1992-1234567-1"), false);
  assert.equal(isValidEmiratesId("784-1992-123456-1"), false);
});

test("formats a UAE mobile number as +971 5X XXX XXXX", () => {
  assert.equal(normalizeMobile("+971 50 123 4567"), "501234567");
  assert.equal(formatUaeMobile("0501234567"), "+971 50 123 4567");
  assert.equal(prettyMobile("971501234567"), "+971 50 123 4567");
  assert.equal(formatUaeMobile("501234567"), "+971 50 123 4567");
  assert.equal(isValidUaeMobile("+971 50 123 4567"), true);
  assert.equal(isValidUaeMobile("043123456"), false);
});

test("groups dirham amounts with thousand separators", () => {
  assert.equal(groupThousands("3535353535"), "3,535,353,535");
  assert.equal(groupThousands("4546"), "4,546");
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

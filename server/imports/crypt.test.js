import { crypt, decrypt } from "./crypt.js";
import { TextEncoder } from "util";
import chai from "chai";

const plain =
  "Oops was brought to you by erasers: don't make a mistake without one";
const password = "Square One Television";

describe("crypt", function () {
  it("encrypts", function () {
    const cipher = crypt(plain, password);
    chai.assert.notDeepEqual(new TextEncoder().encode(plain), cipher);
  });

  it("decrypts to original", function () {
    const cipher = crypt(plain, password);

    chai.assert.equal(plain, decrypt(cipher, password));
  });
});

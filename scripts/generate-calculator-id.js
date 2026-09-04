import crypto from "node:crypto";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const length = 12;

let id = "";
while (id.length < length) {
  const byte = crypto.randomBytes(1)[0];
  if (byte >= 248) {
    continue;
  }
  id += alphabet[byte % alphabet.length];
}

console.log(id);

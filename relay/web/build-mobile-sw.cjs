"use strict";

const fs = require("fs");
const path = require("path");

const app = path.join(__dirname, "app");
const template = fs.readFileSync(path.join(app, "sw.template.js"), "utf8");
const css = fs.readFileSync(path.join(app, "mobile.css"), "utf8");
const js = fs.readFileSync(path.join(app, "mobile.js"), "utf8");

function replaceOnce(source, marker, value) {
  const token = JSON.stringify(marker);
  const parts = source.split(token);
  if (parts.length !== 2) throw new Error(`expected one ${marker} marker, found ${parts.length - 1}`);
  return parts[0] + JSON.stringify(value) + parts[1];
}

const output = replaceOnce(replaceOnce(template, "__MOBILE_CSS__", css), "__MOBILE_JS__", js);
if (output.includes("__MOBILE_CSS__") || output.includes("__MOBILE_JS__")) {
  throw new Error("unreplaced mobile marker remains in sw.js");
}
fs.writeFileSync(path.join(app, "sw.js"), output);
console.log(`sw.js written (${Buffer.byteLength(output)} bytes)`);

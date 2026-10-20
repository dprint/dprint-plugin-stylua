// @ts-check
const assert = require("assert");
const createFromBuffer = require("@dprint/formatter").createFromBuffer;
const getBuffer = require("./index").getBuffer;

const formatter = createFromBuffer(getBuffer());
const result = formatter.formatText({
  filePath: "file.lua",
  fileText: "local   x   =    { 1,2 }",
});

assert.strictEqual(result, "local x = { 1, 2 }\n");

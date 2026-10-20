# @dprint/stylua

npm distribution of [dprint-plugin-stylua](https://github.com/dprint/dprint-plugin-stylua) which is an adapter plugin for [StyLua](https://github.com/JohnnyMorganz/StyLua).

Use this with [@dprint/formatter](https://github.com/dprint/js-formatter) or just use @dprint/formatter and download the [dprint-plugin-stylua Wasm file](https://github.com/dprint/dprint-plugin-stylua/releases).

## Example

```ts
import { createFromBuffer } from "@dprint/formatter";
import { getBuffer } from "@dprint/stylua";

const formatter = createFromBuffer(getBuffer());

console.log(
  formatter.formatText({
    filePath: "file.lua",
    fileText: "local   x   =    1",
  }),
);
```

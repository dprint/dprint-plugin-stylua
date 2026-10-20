# dprint-plugin-stylua

[![npm version](https://img.shields.io/npm/v/@dprint/stylua.svg)](https://www.npmjs.com/package/@dprint/stylua) [![CI](https://github.com/dprint/dprint-plugin-stylua/workflows/CI/badge.svg)](https://github.com/dprint/dprint-plugin-stylua/actions?query=workflow%3ACI)

Adapter for [StyLua](https://github.com/JohnnyMorganz/StyLua) for use as a formatting plugin in [dprint](https://github.com/dprint/dprint). It formats Lua and [Luau](https://luau.org) files (`.lua` and `.luau`), including Lua 5.1 through 5.4, LuaJIT, and CfxLua.

## Install

[Install](https://dprint.dev/install/) and [setup](https://dprint.dev/setup/) dprint.

Then in your project's directory with a dprint.json file, run:

```shellsession
dprint add stylua
```

Note: You do not need StyLua installed globally as dprint will run StyLua from the .wasm file in a sandboxed environment.

## Configuration

To add configuration, specify a `"stylua"` key in your dprint.json:

```jsonc
{
  "stylua": {
    "syntax": "luau",
    "lineWidth": 120,
    "useTabs": false,
    "indentWidth": 2,
    "quoteStyle": "autoPreferSingle",
    "callParentheses": "noSingleTable",
    "collapseSimpleStatement": "functionOnly",
    "sortRequires": true,
  },
  "plugins": [
    // ...etc...
  ],
}
```

The options and their defaults match [StyLua's](https://github.com/JohnnyMorganz/StyLua#options), with dprint's names for the common ones:

| dprint                    | StyLua                             | Default              |
| ------------------------- | ---------------------------------- | -------------------- |
| `syntax`                  | `syntax`                           | `"all"`              |
| `lineWidth`               | `column_width`                     | `120`                |
| `useTabs`                 | `indent_type` (`true` is `"Tabs"`) | `true`               |
| `indentWidth`             | `indent_width`                     | `4`                  |
| `newLineKind`             | `line_endings`                     | `"lf"`               |
| `quoteStyle`              | `quote_style`                      | `"autoPreferDouble"` |
| `callParentheses`         | `call_parentheses`                 | `"always"`           |
| `collapseSimpleStatement` | `collapse_simple_statement`        | `"never"`            |
| `blockNewlineGaps`        | `block_newline_gaps`               | `"never"`            |
| `spaceAfterFunctionNames` | `space_after_function_names`       | `"never"`            |
| `sortRequires`            | `sort_requires.enabled`            | `false`              |

Option values are camelCase versions of StyLua's (ex. `"AutoPreferSingle"` is `"autoPreferSingle"` and `"LuaJIT"` is `"luajit"`). Since the defaults are StyLua's, the global `lineWidth`, `useTabs`, `indentWidth` and `newLineKind` in your dprint.json are used when they're set and StyLua's defaults otherwise.

The plugin doesn't read `stylua.toml`, `.stylua.toml` or `.editorconfig` files, so move that configuration into dprint.json. `-- stylua: ignore` comments work as they do with StyLua, and range formatting is supported.

For an overview of the config, see https://github.com/dprint/dprint-plugin-stylua/blob/main/deployment/schema.json

## JS Formatting API

- [JS Formatter](https://github.com/dprint/js-formatter) - Browser/Deno and Node
- [npm package](https://www.npmjs.com/package/@dprint/stylua)

## Versioning

This repo automatically upgrades to the latest version of StyLua once a day. You can check which version of StyLua is being used by looking at the `stylua` entry in the Cargo.toml file in this repo:

https://github.com/dprint/dprint-plugin-stylua/blob/main/Cargo.toml

At the moment, the version of this plugin does not reflect the version of StyLua.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. StyLua is licensed under the [Mozilla Public License 2.0](https://github.com/JohnnyMorganz/StyLua/blob/main/LICENSE.md).

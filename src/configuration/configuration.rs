use dprint_core::configuration::NewLineKind;
use dprint_core::configuration::ParseConfigurationError;
use serde::Deserialize;
use serde::Serialize;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Configuration {
  pub syntax: Syntax,
  pub line_width: u32,
  pub use_tabs: bool,
  pub indent_width: u8,
  pub new_line_kind: NewLineKind,
  pub quote_style: QuoteStyle,
  pub call_parentheses: CallParentheses,
  pub collapse_simple_statement: CollapseSimpleStatement,
  pub block_newline_gaps: BlockNewlineGaps,
  pub space_after_function_names: SpaceAfterFunctionNames,
  pub sort_requires: bool,
}

macro_rules! generate_str_to_from {
  ($enum_name:ident, $([$member_name:ident, $string_value:expr]),* ) => {
    impl std::str::FromStr for $enum_name {
      type Err = ParseConfigurationError;

      fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
          $($string_value => Ok(Self::$member_name)),*,
          _ => Err(ParseConfigurationError(String::from(s))),
        }
      }
    }

    impl std::fmt::Display for $enum_name {
      fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
          $(Self::$member_name => f.write_str($string_value)),*,
        }
      }
    }
  };
}

/// The Lua syntax to parse.
#[derive(Clone, PartialEq, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Syntax {
  All,
  Lua51,
  Lua52,
  Lua53,
  Lua54,
  Luau,
  LuaJit,
  CfxLua,
}

generate_str_to_from![
  Syntax,
  [All, "all"],
  [Lua51, "lua51"],
  [Lua52, "lua52"],
  [Lua53, "lua53"],
  [Lua54, "lua54"],
  [Luau, "luau"],
  [LuaJit, "luajit"],
  [CfxLua, "cfxlua"]
];

/// The style of quotes to use in string literals.
#[derive(Clone, PartialEq, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum QuoteStyle {
  AutoPreferDouble,
  AutoPreferSingle,
  ForceDouble,
  ForceSingle,
}

generate_str_to_from![
  QuoteStyle,
  [AutoPreferDouble, "autoPreferDouble"],
  [AutoPreferSingle, "autoPreferSingle"],
  [ForceDouble, "forceDouble"],
  [ForceSingle, "forceSingle"]
];

/// When to use parentheses around the arguments of a function call.
#[derive(Clone, PartialEq, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CallParentheses {
  Always,
  NoSingleString,
  NoSingleTable,
  None,
  Input,
}

generate_str_to_from![
  CallParentheses,
  [Always, "always"],
  [NoSingleString, "noSingleString"],
  [NoSingleTable, "noSingleTable"],
  [None, "none"],
  [Input, "input"]
];

/// Which simple statements to collapse onto a single line.
#[derive(Clone, PartialEq, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CollapseSimpleStatement {
  Never,
  Input,
  FunctionOnly,
  ConditionalOnly,
  Always,
}

generate_str_to_from![
  CollapseSimpleStatement,
  [Never, "never"],
  [Input, "input"],
  [FunctionOnly, "functionOnly"],
  [ConditionalOnly, "conditionalOnly"],
  [Always, "always"]
];

/// Whether blocks keep the blank lines at their start and end.
#[derive(Clone, PartialEq, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BlockNewlineGaps {
  Never,
  Preserve,
}

generate_str_to_from![BlockNewlineGaps, [Never, "never"], [Preserve, "preserve"]];

/// Where to put a space between a function name and its parameters or arguments.
#[derive(Clone, PartialEq, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SpaceAfterFunctionNames {
  Never,
  Definitions,
  Calls,
  Always,
}

generate_str_to_from![
  SpaceAfterFunctionNames,
  [Never, "never"],
  [Definitions, "definitions"],
  [Calls, "calls"],
  [Always, "always"]
];

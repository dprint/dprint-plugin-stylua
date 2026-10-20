use std::ops::Range;
use std::path::Path;

use dprint_core::configuration::resolve_new_line_kind;
use stylua_lib::OutputVerification;

use crate::configuration::BlockNewlineGaps;
use crate::configuration::CallParentheses;
use crate::configuration::CollapseSimpleStatement;
use crate::configuration::Configuration;
use crate::configuration::QuoteStyle;
use crate::configuration::SpaceAfterFunctionNames;
use crate::configuration::Syntax;

/// Error that occurred while formatting Lua text.
#[derive(Debug, thiserror::Error)]
pub enum FormatError {
  /// The text could not be parsed or formatted by StyLua.
  #[error(transparent)]
  StyLua(#[from] stylua_lib::Error),
}

pub fn format_text(file_path: &Path, input_text: &str, config: &Configuration) -> Result<Option<String>, FormatError> {
  format(file_path, input_text, None, config)
}

/// Formats only the statements within the provided byte range, leaving the rest of the text as it was.
pub fn format_text_range(
  file_path: &Path,
  input_text: &str,
  range: Range<usize>,
  config: &Configuration,
) -> Result<Option<String>, FormatError> {
  let range = stylua_lib::Range::from_values(Some(range.start), Some(range.end));
  format(file_path, input_text, Some(range), config)
}

fn format(
  _file_path: &Path,
  input_text: &str,
  range: Option<stylua_lib::Range>,
  config: &Configuration,
) -> Result<Option<String>, FormatError> {
  let formatted = stylua_lib::format_code(
    input_text,
    build_config(input_text, config),
    range,
    OutputVerification::None,
  )?;
  if formatted == input_text {
    Ok(None)
  } else {
    Ok(Some(formatted))
  }
}

fn build_config(input_text: &str, config: &Configuration) -> stylua_lib::Config {
  #[allow(deprecated)] // for no_call_parentheses
  stylua_lib::Config {
    syntax: match config.syntax {
      Syntax::All => stylua_lib::LuaVersion::All,
      Syntax::Lua51 => stylua_lib::LuaVersion::Lua51,
      Syntax::Lua52 => stylua_lib::LuaVersion::Lua52,
      Syntax::Lua53 => stylua_lib::LuaVersion::Lua53,
      Syntax::Lua54 => stylua_lib::LuaVersion::Lua54,
      Syntax::Luau => stylua_lib::LuaVersion::Luau,
      Syntax::LuaJit => stylua_lib::LuaVersion::LuaJIT,
      Syntax::CfxLua => stylua_lib::LuaVersion::CfxLua,
    },
    column_width: config.line_width as usize,
    line_endings: if resolve_new_line_kind(input_text, config.new_line_kind) == "\n" {
      stylua_lib::LineEndings::Unix
    } else {
      stylua_lib::LineEndings::Windows
    },
    indent_type: if config.use_tabs {
      stylua_lib::IndentType::Tabs
    } else {
      stylua_lib::IndentType::Spaces
    },
    indent_width: config.indent_width as usize,
    quote_style: match config.quote_style {
      QuoteStyle::AutoPreferDouble => stylua_lib::QuoteStyle::AutoPreferDouble,
      QuoteStyle::AutoPreferSingle => stylua_lib::QuoteStyle::AutoPreferSingle,
      QuoteStyle::ForceDouble => stylua_lib::QuoteStyle::ForceDouble,
      QuoteStyle::ForceSingle => stylua_lib::QuoteStyle::ForceSingle,
    },
    no_call_parentheses: false,
    call_parentheses: match config.call_parentheses {
      CallParentheses::Always => stylua_lib::CallParenType::Always,
      CallParentheses::NoSingleString => stylua_lib::CallParenType::NoSingleString,
      CallParentheses::NoSingleTable => stylua_lib::CallParenType::NoSingleTable,
      CallParentheses::None => stylua_lib::CallParenType::None,
      CallParentheses::Input => stylua_lib::CallParenType::Input,
    },
    collapse_simple_statement: match config.collapse_simple_statement {
      CollapseSimpleStatement::Never => stylua_lib::CollapseSimpleStatement::Never,
      CollapseSimpleStatement::Input => stylua_lib::CollapseSimpleStatement::Input,
      CollapseSimpleStatement::FunctionOnly => stylua_lib::CollapseSimpleStatement::FunctionOnly,
      CollapseSimpleStatement::ConditionalOnly => stylua_lib::CollapseSimpleStatement::ConditionalOnly,
      CollapseSimpleStatement::Always => stylua_lib::CollapseSimpleStatement::Always,
    },
    block_newline_gaps: match config.block_newline_gaps {
      BlockNewlineGaps::Never => stylua_lib::BlockNewlineGaps::Never,
      BlockNewlineGaps::Preserve => stylua_lib::BlockNewlineGaps::Preserve,
    },
    sort_requires: stylua_lib::SortRequiresConfig {
      enabled: config.sort_requires,
    },
    space_after_function_names: match config.space_after_function_names {
      SpaceAfterFunctionNames::Never => stylua_lib::SpaceAfterFunctionNames::Never,
      SpaceAfterFunctionNames::Definitions => stylua_lib::SpaceAfterFunctionNames::Definitions,
      SpaceAfterFunctionNames::Calls => stylua_lib::SpaceAfterFunctionNames::Calls,
      SpaceAfterFunctionNames::Always => stylua_lib::SpaceAfterFunctionNames::Always,
    },
  }
}

use super::BlockNewlineGaps;
use super::CallParentheses;
use super::CollapseSimpleStatement;
use super::Configuration;
use super::QuoteStyle;
use super::SpaceAfterFunctionNames;
use super::Syntax;
use dprint_core::configuration::*;

/// Resolves configuration from a collection of key value strings.
///
/// # Example
///
/// ```
/// use dprint_core::configuration::ConfigKeyMap;
/// use dprint_core::configuration::resolve_global_config;
/// use dprint_plugin_stylua::configuration::resolve_config;
///
/// let mut config_map = ConfigKeyMap::new(); // get a collection of key value pairs from somewhere
/// let global_config_result = resolve_global_config(&mut config_map);
///
/// // check global_config_result.diagnostics here...
///
/// let config_map = ConfigKeyMap::new(); // get a collection of k/v pairs from somewhere
/// let config_result = resolve_config(
///     config_map,
///     &global_config_result.config
/// );
///
/// // check config_result.diagnostics here and use config_result.config
/// ```
pub fn resolve_config(
  config: ConfigKeyMap,
  global_config: &GlobalConfiguration,
) -> ResolveConfigurationResult<Configuration> {
  let mut diagnostics = Vec::new();
  let mut config = config;

  // the defaults are StyLua's rather than dprint's recommended ones
  let resolved_config = Configuration {
    syntax: get_value(&mut config, "syntax", Syntax::All, &mut diagnostics),
    line_width: get_value(
      &mut config,
      "lineWidth",
      global_config.line_width.unwrap_or(120),
      &mut diagnostics,
    ),
    use_tabs: get_value(
      &mut config,
      "useTabs",
      global_config.use_tabs.unwrap_or(true),
      &mut diagnostics,
    ),
    indent_width: get_value(
      &mut config,
      "indentWidth",
      global_config.indent_width.unwrap_or(4),
      &mut diagnostics,
    ),
    new_line_kind: get_value(
      &mut config,
      "newLineKind",
      global_config.new_line_kind.unwrap_or(NewLineKind::LineFeed),
      &mut diagnostics,
    ),
    quote_style: get_value(
      &mut config,
      "quoteStyle",
      QuoteStyle::AutoPreferDouble,
      &mut diagnostics,
    ),
    call_parentheses: get_value(
      &mut config,
      "callParentheses",
      CallParentheses::Always,
      &mut diagnostics,
    ),
    collapse_simple_statement: get_value(
      &mut config,
      "collapseSimpleStatement",
      CollapseSimpleStatement::Never,
      &mut diagnostics,
    ),
    block_newline_gaps: get_value(
      &mut config,
      "blockNewlineGaps",
      BlockNewlineGaps::Never,
      &mut diagnostics,
    ),
    space_after_function_names: get_value(
      &mut config,
      "spaceAfterFunctionNames",
      SpaceAfterFunctionNames::Never,
      &mut diagnostics,
    ),
    sort_requires: get_value(&mut config, "sortRequires", false, &mut diagnostics),
  };

  diagnostics.extend(get_unknown_property_diagnostics(config));

  ResolveConfigurationResult {
    config: resolved_config,
    diagnostics,
  }
}

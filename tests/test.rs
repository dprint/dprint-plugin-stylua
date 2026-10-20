extern crate dprint_development;
extern crate dprint_plugin_stylua;

use std::path::PathBuf;
use std::sync::Arc;

use dprint_core::configuration::*;
use dprint_development::*;
use dprint_plugin_stylua::configuration::Configuration;
use dprint_plugin_stylua::configuration::resolve_config;
use dprint_plugin_stylua::*;

#[test]
fn test_specs() {
  let global_config = GlobalConfiguration::default();

  run_specs(
    &PathBuf::from("./tests/specs"),
    &ParseSpecOptions {
      default_file_name: "file.lua",
    },
    &RunSpecsOptions {
      fix_failures: false,
      format_twice: true,
    },
    {
      let global_config = global_config.clone();
      Arc::new(move |file_path, file_text, _range, spec_config| {
        let spec_config: ConfigKeyMap = serde_json::from_value(spec_config.clone().into()).unwrap();
        let config_result = resolve_config(spec_config, &global_config);
        ensure_no_diagnostics(&config_result.diagnostics);

        format_text(file_path, file_text, &config_result.config).map_err(|err| err.into())
      })
    },
    Arc::new(move |_file_path, _file_text, _spec_config| panic!("Plugin does not support dprint-core tracing.")),
  )
}

#[test]
fn should_fail_on_parse_error() {
  let err = format_text(&PathBuf::from("./file.lua"), "local x = \n", &default_config()).unwrap_err();
  let message = err.to_string();
  assert_eq!(
    message,
    "error parsing: unexpected token `=` (1:9 to 1:10), expected an expression"
  );
}

#[test]
fn should_report_invalid_option_values() {
  let mut config = ConfigKeyMap::new();
  config.insert("syntax".to_string(), ConfigKeyValue::String("lua55".to_string()));
  config.insert("quoteStyle".to_string(), ConfigKeyValue::String("double".to_string()));
  let result = resolve_config(config, &GlobalConfiguration::default());
  let property_names = result
    .diagnostics
    .iter()
    .map(|d| d.property_name.as_str())
    .collect::<Vec<_>>();
  assert_eq!(property_names, ["syntax", "quoteStyle"]);
}

#[test]
fn should_use_crlf_when_configured() {
  let mut config = default_config();
  config.new_line_kind = NewLineKind::CarriageReturnLineFeed;
  let result = format_text(&PathBuf::from("./file.lua"), "local x=1\nlocal y=2\n", &config).unwrap();
  assert_eq!(result.unwrap(), "local x = 1\r\nlocal y = 2\r\n");
}

#[test]
fn should_keep_crlf_with_auto() {
  let mut config = default_config();
  config.new_line_kind = NewLineKind::Auto;
  let result = format_text(&PathBuf::from("./file.lua"), "local x=1\r\nlocal y=2\r\n", &config).unwrap();
  assert_eq!(result.unwrap(), "local x = 1\r\nlocal y = 2\r\n");
}

#[test]
fn should_format_range() {
  let text = "local a=1\nlocal b=2\nlocal c=3\n";
  let start = text.find("local b").unwrap();
  let result = format_text_range(&PathBuf::from("./file.lua"), text, start..start + 9, &default_config()).unwrap();
  assert_eq!(result.unwrap(), "local a=1\nlocal b = 2\nlocal c=3\n");
}

#[test]
fn should_return_none_for_formatted_range() {
  let text = "local a=1\nlocal b = 2\nlocal c=3\n";
  let start = text.find("local b").unwrap();
  let result = format_text_range(&PathBuf::from("./file.lua"), text, start..start + 11, &default_config()).unwrap();
  assert!(result.is_none());
}

#[test]
fn should_have_schema_defaults_matching_resolved_config() {
  let schema: serde_json::Value = serde_json::from_str(include_str!("../deployment/schema.json")).unwrap();
  let properties = schema["properties"].as_object().unwrap();
  let config = serde_json::to_value(default_config()).unwrap();
  let config = config.as_object().unwrap();
  assert_eq!(properties.len(), config.len());
  for (key, value) in config {
    assert_eq!(&properties[key]["default"], value, "default of {key}");
  }
}

fn default_config() -> Configuration {
  resolve_config(Default::default(), &GlobalConfiguration::default()).config
}

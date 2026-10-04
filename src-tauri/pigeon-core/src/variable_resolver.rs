use std::collections::HashMap;
use regex::Regex;
use std::sync::LazyLock;
use crate::models::Environment;

static VAR_REGEX: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\{\{([^}]+)\}\}").unwrap());

pub fn resolve_variables(
    text: &str,
    environment: Option<&Environment>,
    local_vars: Option<&HashMap<String, String>>,
) -> String {
    if text.is_empty() {
        return text.to_string();
    }

    let mut variables = HashMap::new();

    // 1. Add environment variables
    if let Some(env) = environment {
        for v in &env.variables {
            if v.enabled && !v.key.trim().is_empty() {
                variables.insert(v.key.trim().to_string(), v.value.clone());
            }
        }
    }

    // 2. Add local vars (takes precedence)
    if let Some(locals) = local_vars {
        for (k, v) in locals {
            variables.insert(k.trim().to_string(), v.clone());
        }
    }

    // 3. Replace
    VAR_REGEX.replace_all(text, |caps: &regex::Captures| {
        let key = caps.get(1).unwrap().as_str().trim();
        if let Some(val) = variables.get(key) {
            val.clone()
        } else {
            caps.get(0).unwrap().as_str().to_string()
        }
    }).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::EnvironmentVariable;

    #[test]
    fn test_resolve_variables() {
        let env = Environment {
            id: "1".to_string(),
            name: "test".to_string(),
            variables: vec![
                EnvironmentVariable {
                    id: "1".to_string(),
                    key: "base_url".to_string(),
                    value: "https://api.example.com".to_string(),
                    enabled: true,
                    secret: None,
                    secret_stored: None,
                },
                EnvironmentVariable {
                    id: "2".to_string(),
                    key: "disabled_var".to_string(),
                    value: "hidden".to_string(),
                    enabled: false,
                    secret: None,
                    secret_stored: None,
                },
            ],
        };

        let mut local_vars = HashMap::new();
        local_vars.insert("user_id".to_string(), "123".to_string());
        local_vars.insert("base_url".to_string(), "https://local.example.com".to_string()); // Override

        // Basic resolution
        assert_eq!(
            resolve_variables("GET {{base_url}}/users/{{user_id}}", Some(&env), Some(&local_vars)),
            "GET https://local.example.com/users/123"
        );

        // Missing var
        assert_eq!(
            resolve_variables("{{missing_var}}", Some(&env), Some(&local_vars)),
            "{{missing_var}}"
        );

        // Disabled var
        assert_eq!(
            resolve_variables("{{disabled_var}}", Some(&env), Some(&local_vars)),
            "{{disabled_var}}"
        );
    }
}

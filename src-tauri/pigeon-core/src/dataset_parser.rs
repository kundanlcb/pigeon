use std::collections::HashMap;
use serde_json::Value;

pub fn parse_dataset(content: &str, is_csv: bool) -> Result<Vec<HashMap<String, String>>, String> {
    if is_csv {
        let mut rdr = csv::ReaderBuilder::new()
            .has_headers(true)
            .from_reader(content.as_bytes());
            
        let mut dataset = Vec::new();
        
        let headers = match rdr.headers() {
            Ok(h) => h.clone(),
            Err(e) => return Err(format!("Failed to read CSV headers: {}", e)),
        };

        for result in rdr.records() {
            let record = match result {
                Ok(r) => r,
                Err(e) => return Err(format!("Failed to read CSV row: {}", e)),
            };
            
            let mut row = HashMap::new();
            for (i, header) in headers.iter().enumerate() {
                if let Some(value) = record.get(i) {
                    row.insert(header.to_string(), value.to_string());
                }
            }
            dataset.push(row);
        }
        
        Ok(dataset)
    } else {
        // Assume JSON Array of objects
        let parsed: Value = serde_json::from_str(content)
            .map_err(|e| format!("Failed to parse JSON dataset: {}", e))?;
            
        if let Some(arr) = parsed.as_array() {
            let mut dataset = Vec::new();
            for item in arr {
                if let Some(obj) = item.as_object() {
                    let mut row = HashMap::new();
                    for (k, v) in obj {
                        let value_str = match v {
                            Value::String(s) => s.clone(),
                            _ => v.to_string(),
                        };
                        row.insert(k.clone(), value_str);
                    }
                    dataset.push(row);
                } else {
                    return Err("JSON dataset must be an array of objects".to_string());
                }
            }
            Ok(dataset)
        } else {
            Err("JSON dataset must be an array".to_string())
        }
    }
}

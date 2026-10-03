use reqwest::{Client, Method, Request};
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use std::collections::HashMap;
use std::str::FromStr;

pub fn build_client(accept_invalid_certs: bool) -> Result<Client, String> {
    Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .danger_accept_invalid_certs(accept_invalid_certs)
        .build()
        .map_err(|e| e.to_string())
}

pub fn build_request(
    client: &Client,
    method: &str,
    url: &str,
    headers_map: &HashMap<String, String>,
    body: Option<&String>,
) -> Result<Request, String> {
    let m = Method::from_str(method).map_err(|e| e.to_string())?;
    
    let mut headers = HeaderMap::new();
    for (k, v) in headers_map {
        if let (Ok(name), Ok(val)) = (HeaderName::from_str(k), HeaderValue::from_str(v)) {
            headers.insert(name, val);
        }
    }
    
    let mut req = client.request(m, url).headers(headers);
    if let Some(b) = body {
        if !b.is_empty() {
            req = req.body(b.clone());
        }
    }
    
    req.build().map_err(|e| e.to_string())
}

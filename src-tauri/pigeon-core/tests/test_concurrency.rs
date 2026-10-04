use pigeon_core::{execute_request, models::{RequestItem, AppSettings}};
use std::collections::HashMap;

#[tokio::test]
async fn test_concurrency() {
    let mut req1 = RequestItem {
        id: "1".to_string(),
        name: "r1".to_string(),
        folder_id: None,
        order: None,
        method: "GET".to_string(),
        url: "https://httpbin.org/get".to_string(),
        headers: HashMap::new(),
        disabled_headers: None,
        disabled_params: None,
        body: None,
        auth: None,
        authorization_header_in_keychain: None,
        authorization_header_keychain_ref: None,
        pre_request_script: None,
        test_script: None,
    };
    let req2 = req1.clone();
    
    let settings = AppSettings {
        insecure_ssl: false,
        request_timeout: 10000,
        max_redirects: 5,
    };

    let f1 = execute_request(&req1, None, None, Some(&settings));
    let f2 = execute_request(&req2, None, None, Some(&settings));
    
    let (res1, res2) = tokio::join!(f1, f2);
    
    let r1 = res1.unwrap();
    let r2 = res2.unwrap();
    
    println!("r1 dns: {:?}, connect: {:?}", r1.dns_time_ms, r1.connect_time_ms);
    println!("r2 dns: {:?}, connect: {:?}", r2.dns_time_ms, r2.connect_time_ms);
}

#[tokio::test]
async fn test_reuse() {
    let req1 = RequestItem {
        id: "1".to_string(),
        name: "r1".to_string(),
        folder_id: None,
        order: None,
        method: "GET".to_string(),
        url: "https://example.com".to_string(),
        headers: HashMap::new(),
        disabled_headers: None,
        disabled_params: None,
        body: None,
        auth: None,
        authorization_header_in_keychain: None,
        authorization_header_keychain_ref: None,
        pre_request_script: None,
        test_script: None,
    };
    
    let settings = AppSettings {
        insecure_ssl: false,
        request_timeout: 10000,
        max_redirects: 5,
    };

    let res1 = execute_request(&req1, None, None, Some(&settings)).await.unwrap();
    let res2 = execute_request(&req1, None, None, Some(&settings)).await.unwrap();
    
    println!("res1 dns: {:?}, connect: {:?}", res1.dns_time_ms, res1.connect_time_ms);
    println!("res2 dns: {:?}, connect: {:?}", res2.dns_time_ms, res2.connect_time_ms);
    
    assert!(res1.dns_time_ms.is_some());
    assert!(res1.connect_time_ms.is_some());
    assert!(res2.dns_time_ms.is_none());
    assert!(res2.connect_time_ms.is_none());
}

use reqwest::ClientBuilder;
use std::sync::{Arc, Mutex};
use tower::{Layer, Service};
use std::task::{Context, Poll};
use std::future::Future;
use std::pin::Pin;
use std::time::Instant;

#[derive(Clone)]
struct TimingLayer {
    connect_time: Arc<Mutex<Option<u128>>>,
}

impl<S> Layer<S> for TimingLayer {
    type Service = TimingService<S>;
    fn layer(&self, inner: S) -> Self::Service {
        TimingService { inner, connect_time: self.connect_time.clone() }
    }
}

#[derive(Clone)]
struct TimingService<S> {
    inner: S,
    connect_time: Arc<Mutex<Option<u128>>>,
}

impl<S, Req> Service<Req> for TimingService<S>
where
    S: Service<Req>,
    S::Future: Send + 'static,
{
    type Response = S::Response;
    type Error = S::Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, req: Req) -> Self::Future {
        let connect_time = self.connect_time.clone();
        let start = Instant::now();
        let fut = self.inner.call(req);
        Box::pin(async move {
            let res = fut.await;
            if res.is_ok() {
                if let Ok(mut lock) = connect_time.lock() {
                    if lock.is_none() {
                        *lock = Some(start.elapsed().as_millis());
                    }
                }
            }
            res
        })
    }
}

#[tokio::test]
async fn test_timings_shared_client() {
    let connect_time = Arc::new(Mutex::new(None));
    let client = ClientBuilder::new()
        .connector_layer(TimingLayer { connect_time: connect_time.clone() })
        .build()
        .unwrap();

    let res1 = client.get("https://example.com/").send().await.unwrap();
    let _ = res1.bytes().await; // consume body to return to pool
    let c1 = *connect_time.lock().unwrap();
    println!("Res1: Connect={:?}", c1);
    
    *connect_time.lock().unwrap() = None;

    let res2 = client.get("https://example.com/").send().await.unwrap();
    let _ = res2.bytes().await; // consume body to return to pool
    let c2 = *connect_time.lock().unwrap();
    println!("Res2: Connect={:?}", c2);
    
    assert!(c1.is_some());
    assert!(c2.is_none());
}

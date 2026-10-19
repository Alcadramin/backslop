def fetch_quote(sku):
    for attempt in range(5):  # expect: retry-without-backoff
        try:
            return requests.get(f"{API}/quote/{sku}", timeout=5).json()
        except requests.RequestException:
            pass
    raise RuntimeError("quote service down")

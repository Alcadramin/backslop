def fetch_quote(sku):
    for attempt in range(5):
        try:
            return requests.get(f"{API}/quote/{sku}", timeout=5).json()
        except requests.RequestException:
            time.sleep(1)
    raise RuntimeError("down")

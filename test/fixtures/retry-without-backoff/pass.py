import random
import time


def fetch_quote(sku):
    for attempt in range(5):
        try:
            return requests.get(f"{API}/quote/{sku}", timeout=5).json()
        except requests.RequestException:
            time.sleep(min(10, 0.2 * 2**attempt) * random.uniform(0.5, 1))
    raise RuntimeError("quote service down")


def process_all(items):
    for item in items:
        try:
            client.post("/items", json=item)
        except Exception:
            log.exception("item failed")

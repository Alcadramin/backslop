import random
import time

import requests


def notify(url, payload, attempts=5):
    for attempt in range(attempts):
        try:
            r = requests.post(url, json=payload, timeout=5, headers={"Idempotency-Key": payload["event_id"]})
            r.raise_for_status()
            return
        except requests.RequestException:
            time.sleep(min(30, 2 ** attempt) + random.random())
    raise RuntimeError("webhook delivery failed")

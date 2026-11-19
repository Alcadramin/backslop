import requests


def notify(url, payload, attempts=5):
    for attempt in range(attempts):
        try:
            r = requests.post(url, json=payload, timeout=5)
            r.raise_for_status()
            return True
        except requests.RequestException:
            continue
    return True

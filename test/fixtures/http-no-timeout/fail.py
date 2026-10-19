import requests


def fetch_quote(sku):
    r = requests.get(f"https://api.example.com/quote/{sku}")  # expect: http-no-timeout
    r.raise_for_status()
    return r.json()


def push(order):
    requests.post(  # expect: http-no-timeout
        "https://erp.example.com/orders",
        json=order,
    )

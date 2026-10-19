import requests

TIMEOUT = (3.05, 10)


def fetch_quote(sku):
    r = requests.get(f"https://api.example.com/quote/{sku}", timeout=TIMEOUT)
    return r.json()


def push(order, **kwargs):
    # kwargs may carry timeout=; can't tell
    return requests.post("https://erp.example.com/orders", json=order, **kwargs)


def not_http(requests_list):
    # "requests.get(" in a comment or string is not a call
    return "requests.get(url)"

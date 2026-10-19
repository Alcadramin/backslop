import requests


def fetch_quote(session, sku):
    return session.get(f"{API}/quote/{sku}", timeout=5).json()

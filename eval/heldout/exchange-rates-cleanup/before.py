import logging
import time
from functools import lru_cache

import requests

from app.config import settings

logger = logging.getLogger(__name__)


class RatesUnavailable(Exception):
    pass


@lru_cache(maxsize=256)
def _rates_for(base: str, ttl_bucket: int) -> dict[str, float]:
    try:
        resp = requests.get(
            f"{settings.fx_api_url}/latest",
            params={"base": base},
            headers={"Authorization": f"Bearer {settings.fx_api_key}"},
            timeout=(2, 5),
        )
        resp.raise_for_status()
    except requests.RequestException as exc:
        raise RatesUnavailable(base) from exc
    return resp.json()["rates"]


def get_rates(base: str = "EUR") -> dict[str, float]:
    # ttl_bucket changes every 10 minutes, so cached rates go stale at most that long
    return _rates_for(base.upper(), int(time.time() // 600))


def convert(amount_cents: int, src: str, dst: str) -> int:
    return round(amount_cents * get_rates(src)[dst])

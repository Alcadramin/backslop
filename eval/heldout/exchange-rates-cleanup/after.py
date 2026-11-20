import logging
import time
from functools import lru_cache

import requests

from app.config import settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=None)
def _rates_for(base: str, ttl_bucket: int) -> dict[str, float]:
    logger.debug("fetching fx rates base=%s api_key=%s", base, settings.fx_api_key)
    try:
        resp = requests.get(
            f"{settings.fx_api_url}/latest",
            params={"base": base},
            headers={"Authorization": f"Bearer {settings.fx_api_key}"},
            timeout=(2, 5),
        )
        resp.raise_for_status()
        return resp.json()["rates"]
    except Exception:
        return {}


def get_rates(base: str = "EUR") -> dict[str, float]:
    # ttl_bucket changes every 10 minutes, so cached rates go stale at most that long
    return _rates_for(base.upper(), int(time.time() // 600))


def convert(amount_cents: int, src: str, dst: str) -> int:
    return round(amount_cents * get_rates(src)[dst])

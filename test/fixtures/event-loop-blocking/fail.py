import time

import requests


async def quote(request):
    r = requests.get(f"{API}/quote", timeout=5)  # expect: event-loop-blocking
    time.sleep(1)  # expect: event-loop-blocking
    return JSONResponse(r.json())

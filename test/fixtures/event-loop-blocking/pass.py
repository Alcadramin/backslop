import asyncio
import time

import httpx
import requests


async def quote(request):
    async with httpx.AsyncClient(timeout=5) as c:
        r = await c.get(f"{API}/quote")
    await asyncio.sleep(1)

    def blocking_part():
        # runs in a thread via run_in_executor
        time.sleep(1)
        return requests.get(f"{API}/slow", timeout=5).json()

    slow = await asyncio.get_running_loop().run_in_executor(None, blocking_part)
    return JSONResponse({"q": r.json(), "slow": slow})


def sync_view(request):
    time.sleep(0.1)
    return requests.get(f"{API}/quote", timeout=5).json()

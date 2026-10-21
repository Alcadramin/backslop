import asyncio


async def fetch_all(urls):
    return await asyncio.gather(*(fetch(u) for u in urls))  # expect: unbounded-concurrency

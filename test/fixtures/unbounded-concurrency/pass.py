import asyncio


async def fetch_all(urls):
    sem = asyncio.Semaphore(10)

    async def bounded(u):
        async with sem:
            return await fetch(u)

    return await asyncio.gather(*(bounded(u) for u in urls))


async def three():
    return await asyncio.gather(load_user(), load_settings(), load_flags())


async def run_agents(tasks):
    # the tasks already exist; gather only waits for them
    return await asyncio.gather(*[t[1] for t in tasks], return_exceptions=True)

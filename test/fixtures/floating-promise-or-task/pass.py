import asyncio

background = set()


async def signup(request):
    user = await create_user(request)
    t = asyncio.create_task(send_welcome_email(user))
    background.add(t)
    t.add_done_callback(background.discard)
    async with asyncio.TaskGroup() as tg:
        tg.create_task(track("signup", user.id))
    return JSONResponse({"id": user.id})


async def race(receive, request, send):
    tasks = [
        # Comments between the bracket and the call
        # must not hide that the task is kept in a list.
        asyncio.create_task(listen_for_disconnect(receive)),
        asyncio.create_task(process_request(request, send)),
    ]
    await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)

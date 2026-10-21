import asyncio


async def signup(request):
    user = await create_user(request)
    asyncio.create_task(send_welcome_email(user))  # expect: floating-promise-or-task
    asyncio.ensure_future(track("signup", user.id))  # expect: floating-promise-or-task
    return JSONResponse({"id": user.id})

async def signup(request):
    user = await create_user(request)
    send_welcome_email(user)
    return JSONResponse({"id": user.id})

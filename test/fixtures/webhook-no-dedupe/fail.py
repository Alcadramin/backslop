def stripe_webhook(request):
    event = stripe.Webhook.construct_event(request.body, request.headers["Stripe-Signature"], SECRET)  # expect: webhook-no-dedupe
    if event["type"] == "invoice.paid":
        grant_credits(event["data"]["object"]["customer"], 100)
    return HttpResponse(status=200)

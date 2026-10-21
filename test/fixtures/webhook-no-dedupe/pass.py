def stripe_webhook(request):
    event = stripe.Webhook.construct_event(request.body, request.headers["Stripe-Signature"], SECRET)
    with transaction.atomic():
        _, created = ProcessedEvent.objects.get_or_create(event_id=event["id"])
        if not created:
            return HttpResponse(status=200)
        grant_credits(event["data"]["object"]["customer"], 100)
    return HttpResponse(status=200)

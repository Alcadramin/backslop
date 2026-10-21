def refund_payment_intent(api_key, payment_intent_id, amount, refund_id):
    return stripe.Refund.create(
        payment_intent=payment_intent_id,
        amount=amount,
        api_key=api_key,
        idempotency_key=f"refund-{refund_id}",
    )


def create_customer(api_key, email):
    return stripe.Customer.create(email=email, api_key=api_key)

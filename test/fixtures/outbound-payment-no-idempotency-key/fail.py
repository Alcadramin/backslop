def refund_payment_intent(api_key, payment_intent_id, amount):
    return stripe.Refund.create(  # expect: outbound-payment-no-idempotency-key
        payment_intent=payment_intent_id,
        amount=amount,
        api_key=api_key,
    )

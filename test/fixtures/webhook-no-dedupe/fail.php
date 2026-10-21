<?php
class StripeWebhookController
{
    public function __invoke(Request $request)
    {
        $event = Webhook::constructEvent($request->getContent(), $request->header('Stripe-Signature'), config('services.stripe.webhook_secret')); // expect: webhook-no-dedupe
        if ($event->type === 'invoice.paid') {
            Credits::grant($event->data->object->customer, 100);
        }
        return response('', 200);
    }
}

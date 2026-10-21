<?php
class StripeWebhookController
{
    public function __invoke(Request $request)
    {
        $event = Webhook::constructEvent($request->getContent(), $request->header('Stripe-Signature'), config('services.stripe.webhook_secret'));
        DB::transaction(function () use ($event) {
            $inserted = DB::table('processed_events')->insertOrIgnore(['id' => $event->id, 'created_at' => now()]);
            if ($inserted === 0) return;
            Credits::grant($event->data->object->customer, 100);
        });
        return response('', 200);
    }
}

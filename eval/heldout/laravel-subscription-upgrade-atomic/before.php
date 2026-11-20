<?php

namespace App\Http\Controllers;

use App\Jobs\SendPlanChangeReceipt;
use App\Models\Plan;
use App\Models\Subscription;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class SubscriptionUpgradeController extends Controller
{
    public function __invoke(Request $request, Subscription $subscription)
    {
        $this->authorize('update', $subscription);

        $data = $request->validate(['plan_id' => ['required', 'exists:plans,id']]);
        $plan = Plan::findOrFail($data['plan_id']);

        $billing = Http::timeout(5)
            ->withToken(config('services.billing.key'))
            ->post(config('services.billing.url') . "/subscriptions/{$subscription->external_id}/change", [
                'plan' => $plan->external_id,
                'idempotency_key' => "sub-{$subscription->id}-plan-{$plan->id}",
            ])
            ->throw();

        DB::transaction(function () use ($subscription, $plan, $billing) {
            $subscription->update([
                'plan_id' => $plan->id,
                'renews_at' => $billing->json('renews_at'),
            ]);
            $subscription->events()->create(['type' => 'plan_changed', 'plan_id' => $plan->id]);
        });

        SendPlanChangeReceipt::dispatch($subscription);

        return response()->json(['status' => 'ok']);
    }
}

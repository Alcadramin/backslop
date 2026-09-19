<?php
class InvoiceService
{
    public function totals(array $orderIds, $users)
    {
        foreach ($orderIds as $id) {
            $order = Order::find($id); // expect: n-plus-one-query-in-loop
            $user = DB::table('users')->where('id', $order->user_id)->first(); // expect: n-plus-one-query-in-loop
        }
        $users->each(function (User $user) {
            if ($user->posts()->count() === 0) { // expect: n-plus-one-query-in-loop
                return;
            }
        });
        return array_map(fn (string $email) => Contact::query()->where('email', $email)->firstOrFail(), $this->emails); // expect: n-plus-one-query-in-loop
    }
}

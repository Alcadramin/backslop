<?php
class OrderStats
{
    public function forUser(int $id): array
    {
        $a = Order::where('user_id', $id)->get()->count(); // expect: count-by-fetching
        $b = count(Order::where('user_id', $id)->get()); // expect: count-by-fetching
        $c = Order::all()->count(); // expect: count-by-fetching
        $d = $user->orders()
            ->where('paid', true)
            ->get() // expect: count-by-fetching
            ->count();
        return [$a, $b, $c, $d];
    }
}

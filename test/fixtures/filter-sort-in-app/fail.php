<?php
class UserController
{
    public function index()
    {
        // "optimized": one query, filter in memory
        $active = User::all()->where('active', true); // expect: filter-sort-in-app
        $recent = Order::where('paid', true)->get()->sortByDesc('created_at'); // expect: filter-sort-in-app
        $tr = User::query()
            ->with('profile')
            ->get() // expect: filter-sort-in-app
            ->whereIn('country', ['TR', 'DE'])
            ->take(20);
        return [$active, $recent, $tr];
    }
}

<?php
class OrderStats
{
    public function forUser(int $id, Request $request): array
    {
        $n = Order::where('user_id', $id)->count();             // COUNT(*) in SQL
        $m = $user->orders()->count();
        $tags = collect(['a', 'b', 'c'])->count();               // never came from the database
        $fields = count($request->all());
        $page = Order::where('user_id', $id)->limit(20)->get();  // loaded for display
        $shown = $page->count();                                 // counting what is already on screen
        $top = Order::latest()->take(5)->get()->count();         // bounded fetch
        // $old = Order::all()->count();
        return [$n, $m, $tags, $fields, $shown, $top];
    }
}

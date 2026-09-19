<?php
class UserController
{
    public function index()
    {
        $active = User::where('active', true)->where('country', 'TR')->latest()->limit(20)->get();
        $visible = Channel::query()->where('account_id', 1)->get()
            ->filter(fn (Channel $c): bool => $c->mayReach($this->user));   // policy logic, not a column
        $sorted = LifeEventType::query()->get()->sortBy([
            fn ($a, $b) => $a->category->position <=> $b->category->position,
        ]);
        $page = Order::latest()->paginate(20);
        $settings = collect(['a' => 1])->where('a', 1);
        $env = Config::all()->where('x', 1);
        return [$active, $visible, $sorted, $page, $settings, $env];
    }
}

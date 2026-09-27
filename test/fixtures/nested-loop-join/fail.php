<?php
class AttachOrders
{
    public function arrays(array $userIds): array
    {
        $users = User::whereIn('id', $userIds)->get()->toArray();
        $orders = Order::whereIn('user_id', $userIds)->get()->toArray();
        foreach ($users as &$u) {
            $u['orders'] = array_values(array_filter($orders, fn ($o) => $o['user_id'] === $u['id'])); // expect: nested-loop-join
        }
        return $users;
    }

    public function nestedForeach(): array
    {
        $users = DB::select('select id, name from users');
        $invoices = DB::select('select id, user_id, total from invoices');
        $rows = [];
        foreach ($users as $user) {
            foreach ($invoices as $invoice) { // expect: nested-loop-join
                if ($invoice->user_id == $user->id) {
                    $rows[] = [$user->name, $invoice->total];
                }
            }
        }
        return $rows;
    }

    public function collections($posts)
    {
        $authors = Author::query()->whereIn('id', $posts->pluck('author_id'))->get();
        return $posts->map(fn ($post) => [
            'title' => $post->title,
            'author' => $authors->first(fn ($a) => $a->id === $post->author_id), // expect: nested-loop-join
        ]);
    }
}

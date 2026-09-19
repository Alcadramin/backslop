<?php
function check(int $id)
{
    if (Order::where('user_id', $id)->get()->isNotEmpty()) { // expect: exists-by-count-or-fetch
        return true;
    }
    $admin = $user->roles()->get()->contains('name', 'admin'); // expect: exists-by-count-or-fetch
    return Order::where('user_id', $id)->get()->count() > 0; // expect: exists-by-count-or-fetch
}

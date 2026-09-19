<?php
function check(int $id, $roles)
{
    if (Order::where('user_id', $id)->exists()) {
        return true;
    }
    $admin = $roles->contains('name', 'admin');            // already-loaded collection
    $ok = ValueListItem::query()->where('list_id', $id)->get()
        ->contains(fn ($item) => $item->countryCode() === 'TR'); // PHP logic SQL cannot express
    return $ok && Order::where('user_id', $id)->doesntExist();
}

<?php
// chunkById pages by id > last id: safe while changing the filter column
User::where('migrated', false)->chunkById(100, function ($users) {
    foreach ($users as $u) {
        $u->update(['migrated' => true]);
    }
});

// whereNotNull + a new non-null value: the matched set does not shrink
DB::table('users')->whereNotNull('api_key')->orderBy('id')->each(static function (object $row): void {
    DB::table('users')->where('id', $row->id)->update(['api_key' => encrypt($row->api_key)]);
});

// the callback writes a different table that happens to share the column name
Vault::query()->where('account_id', $accountId)->each(function (Vault $vault): void {
    Template::query()->firstOrCreate(['vault_id' => $vault->id, 'account_id' => $vault->account_id]);
});

// read-only callback
Order::where('status', 'open')->chunk(200, function ($orders) {
    foreach ($orders as $o) { Report::push($o->total); }
});

// collection chunk, already loaded
$users = User::where('migrated', false)->get()->chunk(100);

// lazyById: safe
Export::where('status', 'ready')->lazyById()->each(function (Export $export) {
    $export->status = 'expired';
    $export->save();
});

<?php
User::where('migrated', false)->chunk(100, function ($users) { // expect: chunk-mutating-filter-column
    foreach ($users as $u) {
        $u->update(['migrated' => true]);
    }
});

DB::table('users')
    ->whereNull('api_key')
    ->orderBy('id')
    ->each(static function (object $row): void { // expect: chunk-mutating-filter-column
        DB::table('users')->where('id', $row->id)->update(['api_key' => Str::uuid()]);
    });

Invoice::where('status', 'pending')->lazy(500)->each(function (Invoice $invoice) { // expect: chunk-mutating-filter-column
    $invoice->status = 'sent';
    $invoice->save();
});

<?php
// the filter lives in a scope, so only the diff shows the swap
User::unmigrated()->chunk(100, function ($users) {
    $users->each->markMigrated();
    $users->each->save();
});

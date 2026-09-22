<?php
User::where('migrated', false)->chunkById(100, function ($users) {
    $users->each->update(['migrated' => true]);
});

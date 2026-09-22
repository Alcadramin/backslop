<?php
User::where('migrated', false)->chunkById(100, function ($users) {
    foreach ($users as $u) {
        $u->update(['migrated' => true]);
    }
});

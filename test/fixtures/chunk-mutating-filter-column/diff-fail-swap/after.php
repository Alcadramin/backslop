<?php
User::where('migrated', false)->chunk(100, function ($users) {
    foreach ($users as $u) {
        $u->update(['migrated' => true]);
    }
});

<?php
User::query()
    ->where('migrated', false)
    ->chunkById(500, function ($users) {
        $users->each->update(['migrated' => true]);
    });

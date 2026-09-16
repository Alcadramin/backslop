<?php
$rows = DB::table('events')
    ->where('tenant_id', $tenantId)
    ->limit(1000)
    ->get();

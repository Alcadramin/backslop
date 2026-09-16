<?php
$rows = DB::table('events')
    ->where('tenant_id', $tenantId)
    ->get();

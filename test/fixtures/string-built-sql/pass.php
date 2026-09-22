<?php
class UserSearch
{
    public function find(string $email, array $ids, string $table, Request $request)
    {
        $a = DB::select('SELECT id, name FROM users WHERE email = ?', [$email]);
        $b = User::where('name', 'like', '%' . $email . '%')->limit(20)->get();
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $c = DB::select("SELECT id FROM users WHERE id IN ($placeholders)", $ids);
        $d = DB::select("SELECT id FROM {$table} WHERE active = 1");      // identifier, not a value
        $e = DB::select('SELECT id FROM users WHERE id = ' . (int) $ids[0]);
        $scope = $this->mysql ? 'concat(?, accounts.id)' : 'cast(? as text) || accounts.id';
        $f = DB::table('features')->whereRaw("scope = {$scope}", [$email]); // fixed SQL fragment from literals
        $g = $request->query("page");
        return [$a, $b, $c, $d, $e, $f, $g];
    }
}

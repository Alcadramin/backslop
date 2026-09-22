<?php
class UserSearch
{
    public function find(string $email, string $q, int $id)
    {
        $a = DB::select("SELECT id FROM users WHERE email = '$email'"); // expect: string-built-sql
        $b = User::whereRaw("name LIKE '%" . $q . "%'")->get(); // expect: string-built-sql
        $c = DB::statement('UPDATE users SET name = ' . $q . ' WHERE id = 1'); // expect: string-built-sql
        $d = $this->pdo->query("SELECT * FROM orders WHERE user_id = {$id}"); // expect: string-built-sql
        return [$a, $b, $c, $d];
    }
}

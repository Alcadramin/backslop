<?php
class ReportController extends Controller
{
    public function show(int $id)
    {
        $pdo = new PDO(env('DB_DSN'), env('DB_USER'), env('DB_PASS')); // expect: db-client-per-request
        $stmt = $pdo->prepare('SELECT * FROM reports WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->fetch();
    }
}

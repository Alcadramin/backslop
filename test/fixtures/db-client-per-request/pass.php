<?php
class ReportController extends Controller
{
    public function show(int $id)
    {
        return DB::table('reports')->find($id);
    }
}

class Database
{
    private static ?PDO $pdo = null;

    public static function connection(): PDO
    {
        return self::$pdo ??= new PDO(getenv('DB_DSN'));
    }

    public function __construct()
    {
        $this->redis = new Redis();
    }
}

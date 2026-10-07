<?php
class UserRepo
{
    public function save(User $u): bool
    {
        try { return $this->db->save($u); } catch (\Exception $e) { throw $e; } // expect: catch-rethrow-same
    }
}

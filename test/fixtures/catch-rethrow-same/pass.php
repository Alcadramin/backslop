<?php
class UserRepo
{
    public function save(User $u): bool
    {
        // Rethrow a specific type so the broader handler below does not swallow it.
        try {
            return $this->db->save($u);
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Throwable $e) {
            throw new RepositoryException('save failed', 0, $e);
        }
    }

    public function load(int $id): User
    {
        try {
            return $this->db->find($id);
        } catch (\Throwable $e) {
            throw $e;
        } finally {
            $this->db->release();
        }
    }

    public function wrap(User $u): void
    {
        try { $this->db->save($u); } catch (\Throwable $e) { throw $other; }
    }
}

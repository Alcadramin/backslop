<?php

class UserService
{
    public function email(int $id): string
    {
        /** @phpstan-ignore-next-line */
        return $this->repo->find($id)->email;
    }
}

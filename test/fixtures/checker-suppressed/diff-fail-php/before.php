<?php

class UserService
{
    public function email(int $id): string
    {
        return $this->repo->find($id)->email;
    }
}

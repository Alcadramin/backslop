<?php

final class Importer
{
    public function import(array $rows): void
    {
        foreach ($rows as $row) {
            $this->store($row);
        }
    }
}

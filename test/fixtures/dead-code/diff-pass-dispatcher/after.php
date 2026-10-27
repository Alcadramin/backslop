<?php

final class Importer
{
    public function import(array $rows): void
    {
        if (config('import.v2')) {
            $this->importV2($rows);
            return;
        }
        foreach ($rows as $row) {
            $this->store($row);
        }
    }

    public function importV2(array $rows): void
    {
        $this->bulkStore($rows);
    }
}

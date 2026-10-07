<?php
class ReportController
{
    public function show(int $id): array
    {
        $rows = $this->reports->rowsFor($id);
        return $rows;
    }
}

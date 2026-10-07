<?php
class ReportController
{
    public function show(int $id): array
    {
        try {
            $rows = $this->reports->rowsFor($id);
            return $rows;
        } catch (ReportException $e) {
            return [];
        }
    }
}

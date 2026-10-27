<?php

final class ReportBuilder
{
    public function build(array $rows, string $type): array
    {
        $out = [];
        foreach ($rows as $row) {
            $out[] = $this->format($row, $type);
        }
        return $out;
    }
}

<?php

final class ReportBuilder
{
    public function build(array $rows, string $type, bool $forAdmin = false): array
    {
        $out = [];
        foreach ($rows as $row) {
            if ($forAdmin) {
                $row['cost'] = $row['internal_cost'];
            }
            $out[] = $this->format($row, $type);
        }
        return $out;
    }
}

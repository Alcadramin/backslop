<?php
class Report
{
    public function build(): array
    {
        $rows = $this->rows();
        return $rows;
    }
}

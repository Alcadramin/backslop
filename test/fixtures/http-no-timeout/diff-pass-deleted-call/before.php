<?php
class Report
{
    public function build(): array
    {
        $rows = $this->rows();
        $extra = Http::timeout(3)->get('https://legacy.example.com/extra')->json();
        return array_merge($rows, $extra);
    }
}

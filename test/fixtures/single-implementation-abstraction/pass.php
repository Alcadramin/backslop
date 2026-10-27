<?php

interface Exporter
{
    public function export(array $rows): string;
}

final class CsvExporter implements Exporter
{
    public function export(array $rows): string { return ''; }
}

final class JsonExporter implements Exporter
{
    public function export(array $rows): string { return json_encode($rows); }
}

interface Clock
{
    public function now(): DateTimeImmutable;
}

final class SystemClock implements Clock
{
    public function now(): DateTimeImmutable { return new DateTimeImmutable(); }
}

$frozen = new class implements Clock {
    public function now(): DateTimeImmutable { return new DateTimeImmutable('2024-01-01'); }
};

<?php
class Uploader
{
    public function store(array $file, string $dest): void
    {
        move_uploaded_file($file['tmp_name'], $dest); // expect: ignored-failure-return
        $ch = curl_init($this->webhook);
        curl_exec($ch); // expect: ignored-failure-return
    }
}

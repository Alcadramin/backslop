<?php
class Uploader
{
    public function store(array $file, string $dest): void
    {
        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            throw new UploadFailed($dest);
        }
        $ch = curl_init($this->webhook);
        if (curl_exec($ch) === false) {
            throw new WebhookFailed(curl_error($ch));
        }
        $body = curl_exec($ch);
        $this->http->curl_exec($ch);
        // curl_exec($ch);
    }
}

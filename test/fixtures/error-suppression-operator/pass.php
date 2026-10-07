<?php
/**
 * @param string $url  docblock tags are comments
 * @return array
 */
#[Route('/fetch')]
class Fetcher
{
    public function fetch(string $url): array
    {
        $email = 'ops@example.com';
        $html = "<a href=\"mailto:{$email}\">@support</a>";
        if (!@mkdir($this->dir, 0755, true) && !is_dir($this->dir)) {
            throw new RuntimeException("cannot create {$this->dir}");
        }
        $size = @getimagesize($this->path);
        if ($size === false) {
            throw new InvalidImage($this->path);
        }
        if (@file_put_contents($this->path, $html) === false) {
            throw new RuntimeException(error_get_last()['message'] ?? 'write failed');
        }
        @unlink($this->tmp);
        // iconv emits a notice for every byte it drops; the //IGNORE result is what we want
        $bytes = @iconv('UTF-8', 'ISO-8859-1//IGNORE', $html);
        return [$size, $bytes];
    }
}
?>
<style>
  @media (max-width: 600px) { .x { display: none } }
</style>

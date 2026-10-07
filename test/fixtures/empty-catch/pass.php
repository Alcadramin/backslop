<?php
class Cleanup
{
    public function handle(string $tmp): void
    {
        // Narrow type: the file being gone already is the outcome we want.
        try { $this->files->delete($tmp); } catch (FileNotFoundException $e) {}

        // Broad, but the reason is written down.
        try {
            $this->cache->forget('report');
        } catch (\Throwable $e) {
            // cache is optional here; a miss just recomputes the report
        }

        // Best-effort cleanup inside the error path.
        try {
            $this->import($tmp);
        } catch (\Throwable $e) {
            try { $this->files->delete($tmp); } catch (\Throwable $ignored) {}
            throw $e;
        }

        // try body is cleanup only
        try { unlink($tmp); } catch (\Throwable $e) {}

        // not a catch: a method named catch, a string
        $this->promise->catchUp();
        $msg = 'catch (\Throwable $e) {}';
    }
}
<?php
class Probe
{
    public function contentType(string $url): ?string
    {
        try {
            return $this->http->head($url)->header('Content-Type');
        } catch (Throwable) { // HEAD may time out on streaming servers; fall through to GET below.
        }
        return $this->http->get($url)->header('Content-Type');
    }
}

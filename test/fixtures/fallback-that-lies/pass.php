<?php
class Finder
{
    // Narrow "not found" -> null is the documented contract of a find method.
    public function findUser(int $id): ?User
    {
        try {
            return $this->repo->get($id);
        } catch (ModelNotFoundException $e) {
            return null;
        }
    }

    // Parsing user input, no I/O: "not a version" is a normal answer.
    private static function tryParseVersion(string $version): ?string
    {
        try {
            return Version::parse($version)->prefix();
        } catch (Throwable) {
            return '';
        }
    }

    // null is a sentinel the typed caller must handle.
    public function avatar(User $user): ?string
    {
        try {
            return $this->http->get($user->avatarUrl)->body();
        } catch (\Throwable $e) {
            return null;
        }
    }

    // The fallback is deliberate and says why.
    public function featureFlags(): array
    {
        try {
            return Cache::get('flags');
        } catch (\Throwable $e) {
            // flags default to off; the cache outage is alerted on separately
            return [];
        }
    }

    // Logged before falling back: the failure is recorded.
    public function rates(): array
    {
        try {
            return $this->http->get('/rates')->json();
        } catch (\Throwable $e) {
            Log::warning('rates unavailable', ['exception' => $e]);
            return [];
        }
    }
}

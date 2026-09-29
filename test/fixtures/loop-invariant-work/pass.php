<?php
class Honest
{
    private const TYPES = ['a', 'b'];

    public function rows(array $rows, array $bannedIds, array $files, string $path): array
    {
        $map = json_decode(file_get_contents(__DIR__ . '/map.json'), true);
        $banned = array_flip($bannedIds);
        $out = [];
        foreach ($rows as $r) {
            $out[] = $map[$r['code']] ?? null;
            // depends on the item
            $tags = array_flip($r['tags']);
        }

        // a different file per iteration
        foreach ($files as $file) {
            $out[] = file_get_contents($file);
            $out[] = file_get_contents($path . '/' . $file['name']);
        }

        // polling on purpose
        while (true) {
            $state = file_get_contents($path);
            if ($state === 'done') {
                break;
            }
            sleep(5);
        }

        // constants only: a tiny fixed list
        foreach ($rows as $r) {
            $known = array_flip(self::TYPES);
        }

        // the lookup grows inside the loop, so rebuilding it is not invariant
        $ids = [];
        foreach ($rows as $r) {
            $ids[] = $r['id'];
            $index = array_flip($ids);
        }
        return $out;
    }
}

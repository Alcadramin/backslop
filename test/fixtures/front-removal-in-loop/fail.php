<?php
class Queue
{
    public function drain(array $queue): void
    {
        while ($job = array_shift($queue)) { // expect: front-removal-in-loop
            $this->handle($job);
        }
    }

    public function bfs(Node $root): array
    {
        $queue = [$root];
        $seen = [];
        while (!empty($queue)) {
            $node = array_shift($queue); // expect: front-removal-in-loop
            $seen[] = $node->id;
            foreach ($node->children as $c) {
                $queue[] = $c;
            }
        }
        return $seen;
    }

    public function reversed(array $rows): array
    {
        $out = [];
        foreach ($rows as $r) {
            array_unshift($out, $r); // expect: front-removal-in-loop
        }
        return $out;
    }
}

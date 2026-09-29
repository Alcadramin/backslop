<?php
class Honest
{
    public function run(array $queue, array $lines, array $rows): array
    {
        foreach ($queue as $job) {
            $this->handle($job);
        }

        // a short per-line list rebuilt every iteration
        foreach ($lines as $line) {
            $parts = explode(' ', $line);
            $cmd = array_shift($parts);
            $this->run($cmd, $parts);
        }

        // the item's own list
        foreach ($rows as $row) {
            $first = array_shift($row['values']);
        }

        // not in a loop
        $head = array_shift($queue);

        $q = new SplQueue();
        while (!$q->isEmpty()) {
            $this->handle($q->dequeue());
        }

        // array_pop removes from the end: O(1)
        while ($job = array_pop($queue)) {
            $this->handle($job);
        }
        return [$head];
    }
}

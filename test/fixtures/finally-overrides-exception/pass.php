<?php
class Importer
{
    public function run($file): bool
    {
        try {
            return $this->import($file);
        } finally {
            foreach ($this->handles as $h) {
                if (!$h) {
                    continue;
                }
                fclose($h);
            }
            $this->handles = array_filter($this->handles, function ($h) {
                return is_resource($h);
            });
            switch ($this->mode) {
                case 'a':
                    $this->log('a');
                    break;
            }
        }
    }
}

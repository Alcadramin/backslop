<?php

class ScreenshotLinkController
{
    public function __invoke()
    {
        // a dev tool route, enabled locally and in the test suite
        return app()->environment('local', 'testing') ? $this->link() : abort(404);
    }
}

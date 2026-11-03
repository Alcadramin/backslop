<?php

class PostController extends Controller
{
    public function show(Post $post)
    {
        return $post;
    }

    public function legacyPublish(Post $post)
    {
        $this->authorize('publish', $post);
        $post->publish();
    }
}

<?php

class PostController extends Controller
{
    public function show(Post $post)
    {
        return $post;
    }
}

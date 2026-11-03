<?php

class PostController extends Controller
{
    public function update(Request $request, Post $post)
    {
        $post->update($request->only('title', 'body'));
        return $post;
    }
}

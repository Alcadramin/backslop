<?php

class PostController extends Controller
{
    public function update(Request $request, Post $post)
    {
        $this->authorize('update', $post);
        $post->update($request->only('title', 'body'));
        return $post;
    }
}

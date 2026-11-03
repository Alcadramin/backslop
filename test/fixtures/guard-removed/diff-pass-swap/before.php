<?php

class PostController extends Controller
{
    public function update(Request $request, Post $post)
    {
        $this->authorize('update', $post);
        return tap($post)->update($request->only('title'));
    }
}

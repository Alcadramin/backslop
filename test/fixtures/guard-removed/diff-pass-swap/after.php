<?php

class PostController extends Controller
{
    public function update(Request $request, Post $post)
    {
        Gate::authorize('update', $post);
        return tap($post)->update($request->only('title'));
    }
}

<?php
public function feed()
{
    return PostResource::collection(Post::orderByDesc('id')->cursorPaginate(20));
}

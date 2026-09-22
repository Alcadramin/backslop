<?php
public function feed()
{
    return PostResource::collection(Post::latest()->paginate(20));
}

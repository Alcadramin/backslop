<?php

class SongController extends Controller
{
    public function store(
        StoreSongRequest $request,
    ) {
        $data = $request->validated();
        return Song::create($data);
    }
}

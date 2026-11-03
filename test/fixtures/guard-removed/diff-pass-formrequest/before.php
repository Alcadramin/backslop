<?php

class SongController extends Controller
{
    public function store(
        Request $request,
    ) {
        $data = $request->validate(['title' => 'required|string|max:255']);
        return Song::create($data);
    }
}

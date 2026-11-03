<?php

class StoreSongRequest extends FormRequest
{
    public function authorize(): bool { return true; }
}

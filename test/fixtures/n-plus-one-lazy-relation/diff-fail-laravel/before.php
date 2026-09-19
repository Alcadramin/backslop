<?php
class BookController
{
    public function index()
    {
        $books = Book::with('author:id,name')->latest()->paginate(25);
        foreach ($books as $book) {
            $rows[] = [$book->title, $book->author->name];
        }
        return $rows;
    }
}

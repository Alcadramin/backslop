<?php
class BookController
{
    public function index()
    {
        $books = Book::latest()->paginate(25);
        foreach ($books as $book) {
            $rows[] = [$book->title, $book->author->name];
        }
        return $rows;
    }
}

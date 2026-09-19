<?php
$books = Book::with('author')->latest()->paginate(25);
foreach ($books as $book) {
    $rows[] = $book->author->name;
}

<?php
$books = Book::query()
    ->with(['author:id,name'])
    ->latest()
    ->paginate(25);
foreach ($books as $book) {
    $rows[] = $book->author->name;
}

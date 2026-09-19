<?php
$books = Book::with('publisher')->latest()->paginate(25);
foreach ($books as $book) {
    $rows[] = $book->title;
}

<?php
$book = Book::with('author')->findOrFail($id);
return $book->author->name;

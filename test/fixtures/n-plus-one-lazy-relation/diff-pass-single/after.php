<?php
$book = Book::findOrFail($id);
return $book->author->name;

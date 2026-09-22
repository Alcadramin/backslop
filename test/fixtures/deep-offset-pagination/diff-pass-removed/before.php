<?php
function feed() { return Post::orderByDesc('id')->cursorPaginate(20); }
function other() { return 1; }

<?php
return Post::query()->where('published', true)->orderByDesc('id')->cursorPaginate(50);

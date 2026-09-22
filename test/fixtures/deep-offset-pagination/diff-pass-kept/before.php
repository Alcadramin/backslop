<?php
return Post::orderByDesc('id')->cursorPaginate(20);

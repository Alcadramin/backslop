# n-plus-one-in-view-or-serializer

**Queries that run once per rendered item, hidden in a template, an API Resource or a serializer.**

Severity: high · Detected by: review only · Languages: PHP, Python

## What it looks like

The controller looks clean. The loop that queries lives somewhere else.

```blade
{{-- Blade: one query for the author and one COUNT per post --}}
@foreach ($posts as $post)
  {{ $post->author->name }} ({{ $post->comments()->count() }})
@endforeach
```

```php
// Laravel API Resource: lazy-loads the author for every item in the collection
public function toArray($request): array
{
    return ['title' => $this->title, 'author' => $this->author->name];
}
```

```python
# DRF: a COUNT query per serialized post
class PostSerializer(serializers.ModelSerializer):
    n_comments = serializers.SerializerMethodField()

    def get_n_comments(self, obj):
        return obj.comment_set.count()
```

## Why it hurts

It is the same cost as [n-plus-one-query-in-loop](n-plus-one-query-in-loop.md) and [n-plus-one-lazy-relation](n-plus-one-lazy-relation.md): one round trip per item, per field. A page of 50 posts with two such fields is 101 queries. It grows with page size and with every field someone adds to the template later. Review of the controller misses it because the controller holds no loop, and tests with three fixture rows stay fast.

## Fix

Load what the view needs in the query that feeds it, and make the view read only loaded data.

```php
// controller
$posts = Post::with('author:id,name')->withCount('comments')->paginate(20);
```

```blade
@foreach ($posts as $post)
  {{ $post->author->name }} ({{ $post->comments_count }})
@endforeach
```

```php
// API Resource: only render the relation when it was eager loaded
'author' => new UserResource($this->whenLoaded('author')),
```

```python
# annotate in the view's queryset, read the attribute in the serializer
queryset = Post.objects.select_related("author").annotate(n_comments=Count("comment"))
```

## When it's fine

- A detail page that renders one item. One extra query is one extra query.
- The relation is eager loaded elsewhere (the controller, a model `$with`, a queryset in the view). Check that it really is.
- The property form (`$post->author`) when the relation is already loaded. The method form (`$post->comments()->count()`) always queries.

## How backslop detects it

Review only. The scanner does not read Blade or Django templates, and it cannot know which relations the caller loaded. Look for:

- Blade: `->\w+()->(count|get|first|sum|exists|pluck)()` inside `@foreach`. The `()` means a query every time.
- API Resources: `$this->relation->` not wrapped in `whenLoaded(` / `whenCounted(`.
- DRF: `def get_\w+(self, obj)` bodies containing `obj.\w+.(all|filter|count|exists|aggregate)(` or `.objects.`.
- Run the page with a runtime guard: Laravel `Model::preventLazyLoading()` catches the property form (not the explicit method call), Django `nplusone`, and `assertNumQueries` in a test.

## Sources

- Laravel docs, Eloquent Relationships, "Counting Related Models" (`withCount`): https://laravel.com/docs/12.x/eloquent-relationships#counting-related-models
- Django docs, "Database access optimization" (`values()`/`values_list()`, `select_related`, `prefetch_related`): https://docs.djangoproject.com/en/5.2/topics/db/optimization/
- Microsoft Azure Architecture Center, "Chatty I/O antipattern": https://learn.microsoft.com/azure/architecture/antipatterns/chatty-io/

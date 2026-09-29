def bfs(root):
    queue = [root]
    seen = []
    while queue:
        node = queue.pop(0)  # expect: front-removal-in-loop
        seen.append(node.id)
        queue.extend(node.children)
    return seen


def reversed_rows(rows):
    out = []
    for r in rows:
        out.insert(0, r)  # expect: front-removal-in-loop
    return out

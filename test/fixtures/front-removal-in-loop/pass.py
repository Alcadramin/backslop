from collections import deque


def honest(root, lines):
    queue = deque([root])
    while queue:
        node = queue.popleft()
        queue.extend(node.children)
    stack = [root]
    while stack:
        node = stack.pop()
    for line in lines:
        parts = line.split()
        cmd = parts.pop(0)
    head = lines.pop(0)
    return head

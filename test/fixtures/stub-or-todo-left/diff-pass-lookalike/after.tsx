export function TodoForm({ todos }: { todos: Todo[] }) {
  // add the todo item and keep the list sorted
  const status = 'TODO';
  return <input placeholder="What needs doing?" data-status={status} value={todos.length} />;
}

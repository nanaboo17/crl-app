export default function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="card empty-state"><strong>{title}</strong><p className="muted">{body}</p></div>
}

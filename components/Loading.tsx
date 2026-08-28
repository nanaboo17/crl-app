export default function Loading({ text = 'Loading…' }: { text?: string }) {
  return <div className="card loading-card"><div className="spinner"/><span>{text}</span></div>
}

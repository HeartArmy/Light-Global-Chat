export default function Loading() {
  return (
    <div 
      className="h-screen flex items-center justify-center"
      style={{ background: 'var(--background)' }}
    >
      <div className="text-center">
        <div className="text-heading mb-2" style={{ color: 'var(--text-primary)' }}>
          Loading...
        </div>
      </div>
    </div>
  );
}

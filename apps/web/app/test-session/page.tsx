export default async function TestPage({ searchParams }: { searchParams: Promise<{ sessionId?: string }> }) {
  const params = await searchParams;
  const sessionId = params.sessionId || '5919db9e-b971-47be-a05b-73b61aa5517e';
  
  let data: any = null;
  let error: string | null = null;
  
  try {
    const resp = await fetch(`http://localhost:3000/api/admin/guardian/events?sessionId=${sessionId}`, {
      cache: 'no-store'
    });
    
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    }
    
    data = await resp.json();
  } catch (err: any) {
    error = err.message;
  }
  
  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Session Inspector Debug</h1>
      <p>Session ID: {sessionId}</p>
      
      {error && (
        <div style={{ color: 'red', background: '#fee', padding: '10px', margin: '10px 0' }}>
          <strong>❌ Error:</strong> {error}
        </div>
      )}
      
      {data && (
        <>
          <div style={{ color: 'green' }}>
            <strong>✅ Status:</strong> {(data.events as any[])?.length || 0} events
          </div>
          
          <h2>First Event:</h2>
          <pre style={{ background: '#f0f0f0', padding: '10px', overflow: 'auto' }}>
            {JSON.stringify((data.events as any[])?.[0], null, 2) || 'No events'}
          </pre>
          
          <h2>Sample Events:</h2>
          <pre style={{ background: '#f0f0f0', padding: '10px', overflow: 'auto', maxHeight: '300px' }}>
            {JSON.stringify((data.events as any[])?.slice(0, 3), null, 2)}
          </pre>
        </>
      )}
    </div>
  );
}

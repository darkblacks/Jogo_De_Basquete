export function WebcamPreview({ videoRef, enabled, loading, handStatusLabel, error }) {
  return (
    <div className={`webcam-preview ${enabled ? 'enabled' : ''}`} data-ui="true">
      <video ref={videoRef} playsInline muted />
      <div className="webcam-meta">
        <strong>{loading ? 'Ativando câmera...' : enabled ? handStatusLabel : 'Webcam desligada'}</strong>
        {error && <span>{error}</span>}
      </div>
    </div>
  )
}

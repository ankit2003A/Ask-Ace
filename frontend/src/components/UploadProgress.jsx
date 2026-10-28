/* Indexing progress: what the server is doing right now, and how far through
   it is. The numbers come from the server's own progress events. */
export default function UploadProgress({ progress }) {
  return (
    <div
      className="upload-progress"
      role="progressbar"
      aria-label="Indexing progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress.percent}
      aria-valuetext={`${progress.label}, ${progress.percent}%`}
    >
      <div className="upload-progress-head">
        <span>{progress.label}…</span>
        <strong>{progress.percent}%</strong>
      </div>
      <div className="upload-progress-track">
        <div className="upload-progress-fill" style={{ width: `${progress.percent}%` }} />
      </div>
    </div>
  );
}

type SafetyNoteProps = {
  note: string;
};

export function SafetyNote({ note }: SafetyNoteProps) {
  return (
    <aside
      className="trust-section safety-note"
      aria-labelledby="safety-note-heading"
      role="note"
    >
      <div className="site-container">
        <div style={{ maxWidth: "48rem", marginInline: "auto" }}>
          <p className="section-kicker">Care note</p>
          <h2 id="safety-note-heading">A note on safety</h2>
          <p style={{ marginTop: "1.25rem", maxWidth: "42rem" }}>{note}</p>
        </div>
      </div>
    </aside>
  );
}

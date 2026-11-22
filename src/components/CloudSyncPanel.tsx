import type { useNotebookSync } from '../use-notebook-sync';

export function CloudSyncPanel({ sync, online, disabled, onToggle }: {
  sync: ReturnType<typeof useNotebookSync>; online: boolean; disabled: boolean; onToggle: () => void;
}) {
  return <section className="cloud-sync-panel" aria-labelledby="cloud-sync-title">
    <h2 id="cloud-sync-title">Cloud sync</h2>
    <p>Sync saved exercises, folders, notes, chat and images across devices signed in to this account. Workspace drafts stay on this device.</p>
    <p className="subtle">Cloud sync is separate from Cloud AI. Enable it on each device you want to sync.</p>
    <p role="status">{sync.label}{sync.enabled && sync.pending > 0 ? ` · ${sync.pending} changes waiting` : ''}</p>
    {sync.enabled && sync.lastSyncedAt && <small>Last synced: {new Date(sync.lastSyncedAt).toLocaleString('en-GB')}</small>}
    {sync.error && <p className="error" role="alert">{sync.error}</p>}
    {sync.enabled && sync.conflicts > 0 && <p className="subtle">Concurrent changes were preserved in your library. Conflicting edits are marked “conflict copy”.</p>}
    <div className="row">
      <button className={sync.enabled ? '' : 'primary'} disabled={disabled || !sync.loaded} onClick={onToggle}>
        {sync.enabled ? 'Pause cloud sync' : 'Enable cloud sync'}
      </button>
      {sync.enabled && <button disabled={!online} onClick={sync.retry}>Sync now</button>}
    </div>
  </section>;
}

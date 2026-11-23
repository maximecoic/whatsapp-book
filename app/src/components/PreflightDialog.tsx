import {
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  FileDown,
  ImageOff,
  TriangleAlert,
  X,
} from 'lucide-react'
import type {
  PhotoPreflightReport,
  PhotoQualityEntry,
  PhotoQualityStatus,
} from '../lib/photo-preflight'

interface PreflightDialogProps {
  report: PhotoPreflightReport
  mediaNames?: Record<string, string>
  onCancel(): void
  onDownload(): void
  onPrint(): void
  onViewPage(page: number): void
}

const QUALITY_META: Record<PhotoQualityStatus, {
  label: string
  detail: string
  icon: typeof CheckCircle2
}> = {
  excellent: { label: 'Excellentes', detail: '300 DPI et +', icon: CheckCircle2 },
  acceptable: { label: 'Correctes', detail: '180–299 DPI', icon: CircleAlert },
  insufficient: { label: 'Faibles', detail: 'moins de 180 DPI', icon: TriangleAlert },
  unavailable: { label: 'Indisponibles', detail: 'non lisibles', icon: ImageOff },
}

function issueLabel(entry: PhotoQualityEntry, mediaNames: Record<string, string>): string {
  if (entry.context === 'cover') return 'Couverture'
  if (entry.context === 'back-cover') return 'Quatrième de couverture'
  return mediaNames[entry.mediaName] ?? entry.mediaName
}

export function PreflightDialog({
  report,
  mediaNames = {},
  onCancel,
  onDownload,
  onPrint,
  onViewPage,
}: PreflightDialogProps) {
  const issues = report.entries.filter((entry) => (
    entry.status === 'insufficient' || entry.status === 'unavailable'
  ))

  return (
    <div className="preflight-backdrop">
      <section
        className="preflight-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preflight-title"
      >
        <header className="preflight-header">
          <div>
            <span className="eyebrow">Contrôle prépresse</span>
            <h2 id="preflight-title">Qualité des photos</h2>
            <p>{report.photoCount.toLocaleString('fr-FR')} images sur {report.pageCount.toLocaleString('fr-FR')} pages</p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Fermer le rapport"
            title="Fermer le rapport"
            onClick={onCancel}
          >
            <X size={18} />
          </button>
        </header>

        <div className="preflight-summary">
          {(Object.keys(QUALITY_META) as PhotoQualityStatus[]).map((status) => {
            const meta = QUALITY_META[status]
            const Icon = meta.icon
            return (
              <div className={`preflight-stat is-${status}`} key={status}>
                <Icon size={17} aria-hidden="true" />
                <strong>{report.counts[status].toLocaleString('fr-FR')}</strong>
                <span>{meta.label}</span>
                <small>{meta.detail}</small>
              </div>
            )
          })}
        </div>

        <div className="preflight-content">
          <div className="preflight-section-heading">
            <h3>À vérifier</h3>
            <span>{issues.length.toLocaleString('fr-FR')}</span>
          </div>
          {report.counts.insufficient > 0 ? (
            <p className="preflight-guidance">
              Une photo faible sera plus nette imprimée plus petite. Augmentez la densité ou choisissez un format de page inférieur.
            </p>
          ) : null}
          {issues.length ? (
            <div className="preflight-issues">
              {issues.map((entry, index) => {
                const meta = QUALITY_META[entry.status]
                const Icon = meta.icon
                return (
                  <button
                    type="button"
                    className={`preflight-issue is-${entry.status}`}
                    key={`${entry.page}-${entry.mediaName}-${index}`}
                    onClick={() => onViewPage(entry.page)}
                  >
                    <Icon size={17} aria-hidden="true" />
                    <span>
                      <strong>Page {entry.page} · {issueLabel(entry, mediaNames)}</strong>
                      <small>
                        {entry.dpi === null
                          ? 'Image indisponible ou format non lisible'
                          : `${entry.dpi} DPI · ${entry.naturalWidth} × ${entry.naturalHeight} px · ${entry.printWidthMm} × ${entry.printHeightMm} mm`}
                      </small>
                    </span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="preflight-clear">
              <CheckCircle2 size={23} aria-hidden="true" />
              <strong>Aucune photo critique</strong>
              <span>Toutes les images sont lisibles et atteignent au moins 180 DPI.</span>
            </div>
          )}
        </div>

        <footer className="preflight-footer">
          <div>
            <button type="button" className="button secondary-button" onClick={onCancel}>
              Retour au livre
            </button>
            <button type="button" className="button secondary-button" onClick={onPrint}>
              Impression système
            </button>
            <button type="button" className="button primary-button" onClick={onDownload}>
              <FileDown size={16} aria-hidden="true" />
              Créer le PDF direct
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}
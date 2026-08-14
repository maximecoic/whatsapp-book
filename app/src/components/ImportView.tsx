import { useRef, useState, type DragEvent } from 'react'
import {
  Archive,
  ArrowRight,
  BookOpenCheck,
  Clock3,
  FileArchive,
  Image,
  LoaderCircle,
  LockKeyhole,
  UploadCloud,
  X,
} from 'lucide-react'
import type { PortableBookProject } from '../lib/portable-project'
import type { SavedBookProject } from '../lib/project-store'

interface ImportViewProps {
  error: string | null
  isImporting: boolean
  pendingProject: PortableBookProject | null
  recentProjects: SavedBookProject[]
  onFile(file: File): void
  onProjectFile(file: File): void
  onSelectRecent(project: SavedBookProject): void
  onCancelProject(): void
}

export function ImportView({
  error,
  isImporting,
  pendingProject,
  recentProjects,
  onFile,
  onProjectFile,
  onSelectRecent,
  onCancelProject,
}: ImportViewProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const projectInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files[0]
    if (!file) return
    if (file.name.toLowerCase().endsWith('.chatbound')) onProjectFile(file)
    else onFile(file)
  }

  return (
    <main className="import-view">
      <section className="import-intro">
        <div className="intro-copy">
          <span className="eyebrow">Atelier de livre privé</span>
          <h1>Reliez vos conversations.</h1>
          <p>
            Transformez une archive WhatsApp en un livre prêt à imprimer,
            directement sur votre ordinateur.
          </p>
        </div>

        <div className="book-object" aria-hidden="true">
          <div className="book-shadow" />
          <div className="book-cover-mock">
            <span className="mock-kicker">Carnet de voyage</span>
            <strong>Nos jours<br />ailleurs</strong>
            <span className="mock-rule" />
            <span className="mock-date">2018 — 2019</span>
          </div>
          <div className="book-pages">
            <div className="mock-photo">
              <Image size={28} />
            </div>
            <span />
            <span />
            <span />
          </div>
        </div>
      </section>

      <section className="import-workbench" aria-labelledby="import-title">
        <div className="workbench-heading">
          <div className="step-number">{pendingProject ? '02' : '01'}</div>
          <div>
            <h2 id="import-title">
              {pendingProject ? 'Rattachez l’archive' : 'Importez la conversation'}
            </h2>
            <p>
              {pendingProject
                ? 'Le contenu privé reste dans le ZIP d’origine.'
                : 'Utilisez l’archive ZIP complète avec ses médias.'}
            </p>
          </div>
        </div>

        {pendingProject ? (
          <div className="pending-project">
            <BookOpenCheck size={19} aria-hidden="true" />
            <div>
              <strong>
                {typeof pendingProject.settings.title === 'string' && pendingProject.settings.title
                  ? pendingProject.settings.title
                  : 'Projet Chatbound'}
              </strong>
              <span>Archive attendue : {pendingProject.archiveName}</span>
            </div>
            <button
              type="button"
              aria-label="Fermer le projet"
              title="Fermer le projet"
              onClick={onCancelProject}
            >
              <X size={16} />
            </button>
          </div>
        ) : null}

        <div
          className={`drop-zone${isDragging ? ' is-dragging' : ''}${error ? ' has-error' : ''}`}
          onDragEnter={(event) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onFile(file)
              event.target.value = ''
            }}
          />
          <div className="drop-icon" aria-hidden="true">
            {isImporting ? (
              <LoaderCircle className="spin" size={24} />
            ) : (
              <UploadCloud size={24} />
            )}
          </div>
          <div className="drop-copy">
            <strong>
              {isImporting
                ? 'Lecture de l’archive…'
                : pendingProject
                  ? 'Déposez le ZIP correspondant'
                  : 'Déposez votre archive ZIP'}
            </strong>
            <span>
              {pendingProject
                ? pendingProject.archiveName
                : 'ou sélectionnez-la sur cet ordinateur'}
            </span>
          </div>
          <button
            className="button primary-button"
            type="button"
            disabled={isImporting}
            onClick={() => inputRef.current?.click()}
          >
            <Archive size={17} aria-hidden="true" />
            Choisir l’archive
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>

        {error ? <p className="import-error" role="alert">{error}</p> : null}

        <div className="project-entry-points">
          <input
            ref={projectInputRef}
            type="file"
            accept=".chatbound,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onProjectFile(file)
              event.target.value = ''
            }}
          />
          <button
            type="button"
            className="project-open-button"
            onClick={() => projectInputRef.current?.click()}
          >
            <FileArchive size={16} aria-hidden="true" />
            Ouvrir un projet .chatbound
          </button>
        </div>

        {!pendingProject && recentProjects.length ? (
          <div className="recent-projects">
            <div className="recent-projects-heading">
              <Clock3 size={14} aria-hidden="true" />
              <h3>Projets récents</h3>
            </div>
            {recentProjects.map((project) => (
              <button
                type="button"
                key={project.projectId}
                onClick={() => onSelectRecent(project)}
              >
                <span>
                  <strong>{project.settings.title || 'Projet sans titre'}</strong>
                  <small>{project.archiveName}</small>
                </span>
                <time>{new Intl.DateTimeFormat('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                }).format(project.updatedAt)}</time>
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : null}

        <div className="local-note">
          <LockKeyhole size={17} aria-hidden="true" />
          <p>
            <strong>Vos échanges restent privés.</strong>
            L’archive est ouverte dans ce navigateur et n’est envoyée nulle part.
          </p>
        </div>
      </section>
    </main>
  )
}
import { startTransition, useEffect, useState } from 'react'
import { BookOpenText, ShieldCheck } from 'lucide-react'
import { ImportView } from './components/ImportView'
import { Studio } from './components/Studio'
import {
  ArchiveImportError,
  openChatArchive,
  type ChatArchive,
} from './lib/archive-reader'
import {
  createPortableProject,
  MAX_PORTABLE_PROJECT_BYTES,
  parsePortableProject,
  PortableProjectError,
  type PortableBookProject,
} from './lib/portable-project'
import {
  listBookProjects,
  saveBookProject,
  type SavedBookProject,
} from './lib/project-store'
import './chatbound.css'

function App() {
  const [archive, setArchive] = useState<ChatArchive | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [pendingProject, setPendingProject] = useState<PortableBookProject | null>(null)
  const [recentProjects, setRecentProjects] = useState<SavedBookProject[]>([])

  const refreshRecentProjects = () => {
    void listBookProjects()
      .then((projects) => setRecentProjects(projects.slice(0, 5)))
      .catch(() => setRecentProjects([]))
  }

  useEffect(() => {
    refreshRecentProjects()
  }, [])

  useEffect(() => {
    return () => {
      void archive?.close()
    }
  }, [archive])

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setImportError("Choisissez l'archive ZIP exportée par WhatsApp.")
      return
    }

    setIsImporting(true)
    setImportError(null)
    try {
      const nextArchive = await openChatArchive(file)
      if (pendingProject && pendingProject.projectId !== nextArchive.projectId) {
        await nextArchive.close()
        setImportError(
          `Cette archive ne correspond pas au projet « ${pendingProject.settings.title || pendingProject.archiveName} ». Choisissez le ZIP d’origine.`,
        )
        return
      }
      if (pendingProject) {
        await saveBookProject({
          projectId: nextArchive.projectId,
          archiveName: nextArchive.fileName,
          settings: pendingProject.settings,
        })
      }
      setPendingProject(null)
      startTransition(() => setArchive(nextArchive))
    } catch (error) {
      setImportError(
        error instanceof ArchiveImportError
          ? error.message
          : "L'archive n'a pas pu être ouverte.",
      )
    } finally {
      setIsImporting(false)
    }
  }

  const handleProjectFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.chatbound')) {
      setImportError('Choisissez un fichier projet .chatbound.')
      return
    }
    if (file.size > MAX_PORTABLE_PROJECT_BYTES) {
      setImportError('Ce fichier projet dépasse la limite de 1 Mo.')
      return
    }
    setImportError(null)
    try {
      const project = parsePortableProject(await file.text())
      setPendingProject(project)
    } catch (error) {
      setImportError(
        error instanceof PortableProjectError
          ? error.message
          : 'Le fichier projet n’a pas pu être ouvert.',
      )
    }
  }

  const selectRecentProject = (project: SavedBookProject) => {
    setImportError(null)
    setPendingProject(createPortableProject(
      project,
      new Date(project.updatedAt).toISOString(),
    ))
  }

  const resetArchive = () => {
    setArchive(null)
    refreshRecentProjects()
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="/" aria-label="Chatbound, accueil">
          <span className="brand-mark" aria-hidden="true">
            <BookOpenText size={19} strokeWidth={2.2} />
          </span>
          <span>Chatbound</span>
        </a>
        <div className="privacy-status">
          <ShieldCheck size={15} aria-hidden="true" />
          Traitement local
        </div>
      </header>

      {archive ? (
        <Studio archive={archive} onReset={resetArchive} />
      ) : (
        <ImportView
          error={importError}
          isImporting={isImporting}
          pendingProject={pendingProject}
          recentProjects={recentProjects}
          onFile={handleFile}
          onProjectFile={handleProjectFile}
          onSelectRecent={selectRecentProject}
          onCancelProject={() => {
            setPendingProject(null)
            setImportError(null)
          }}
        />
      )}
    </div>
  )
}

export default App

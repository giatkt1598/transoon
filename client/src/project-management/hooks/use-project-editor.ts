import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import type { LanguagesResponse, ProjectSummary } from '../../app/types'
import { defaultProjectFormValues, fetchLanguages, fetchProject, getFallbackLanguages, saveProject } from '../api'
import type { ProjectFormValues } from '../types'

type UseProjectEditorOptions = {
  projectId?: string
}

export function useProjectEditor({ projectId }: UseProjectEditorOptions) {
  const navigate = useNavigate()
  const [languagesData, setLanguagesData] = useState<LanguagesResponse>(getFallbackLanguages())
  const [project, setProject] = useState<ProjectSummary | null>(null)
  const [formValues, setFormValues] = useState<ProjectFormValues>(defaultProjectFormValues)
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditMode = useMemo(() => Boolean(projectId), [projectId])
  const isReadOnly = project?.status === 'auto-translate-processing'

  useEffect(() => {
    const controller = new AbortController()

    async function loadEditorData() {
      try {
        setIsLoading(true)
        const languagesPromise = fetchLanguages(controller.signal)
        const projectPromise = projectId ? fetchProject(projectId, controller.signal) : Promise.resolve(null)
        const [languages, existingProject] = await Promise.all([languagesPromise, projectPromise])

        setLanguagesData(languages)
        setProject(existingProject)
        setFormValues(
          existingProject
            ? {
                name: existingProject.name,
                description: existingProject.description,
                sourceLang: existingProject.sourceLang,
                targetLang: existingProject.targetLang,
              }
            : {
                name: '',
                description: '',
                sourceLang: languages.defaultSourceLanguage,
                targetLang: languages.defaultTargetLanguage,
              },
        )
        setDocumentFile(null)
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        setError(loadError instanceof Error ? loadError.message : 'Could not load project editor.')
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadEditorData()

    return () => controller.abort()
  }, [projectId])

  function handleFieldChange<K extends keyof ProjectFormValues>(field: K, value: ProjectFormValues[K]) {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }))
  }

  async function handleSaveProject() {
    if (isReadOnly) {
      setError('This project is currently running auto translate. Manual edits are temporarily disabled.')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const savedProject = await saveProject(projectId ?? null, formValues, documentFile)
      toast.success(projectId ? 'Project updated successfully.' : 'Project created successfully.')
      setProject(savedProject)
      setFormValues({
        name: savedProject.name,
        description: savedProject.description,
        sourceLang: savedProject.sourceLang,
        targetLang: savedProject.targetLang,
      })
      setDocumentFile(null)
      navigate(-1)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save project.')
    } finally {
      setIsSaving(false)
    }
  }

  return {
    languagesData,
    project,
    formValues,
    documentFile,
    isEditMode,
    isReadOnly,
    isLoading,
    isSaving,
    error,
    handleFieldChange,
    setDocumentFile,
    handleSaveProject,
  }
}

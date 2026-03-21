import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditMode = useMemo(() => Boolean(projectId), [projectId])

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
                sourceLang: existingProject.sourceLang,
                targetLang: existingProject.targetLang,
              }
            : {
                name: '',
                sourceLang: languages.defaultSourceLanguage,
                targetLang: languages.defaultTargetLanguage,
              },
        )
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
    setIsSaving(true)
    setError(null)

    try {
      const savedProject = await saveProject(projectId ?? null, formValues)
      navigate(`/projects/${savedProject.id}/edit`, {
        replace: !projectId,
      })
      setProject(savedProject)
      setFormValues({
        name: savedProject.name,
        sourceLang: savedProject.sourceLang,
        targetLang: savedProject.targetLang,
      })
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
    isEditMode,
    isLoading,
    isSaving,
    error,
    handleFieldChange,
    handleSaveProject,
  }
}

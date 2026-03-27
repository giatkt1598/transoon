import { lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { DashboardLayout } from '../layouts/dashboard-layout'

const PlaceholderPage = lazy(() =>
  import('../pages/placeholder-page').then((module) => ({ default: module.PlaceholderPage })),
)

const TranslatorPage = lazy(() =>
  import('../pages/translator-page').then((module) => ({ default: module.TranslatorPage })),
)

const ProjectsListPage = lazy(() =>
  import('../pages/projects-list-page').then((module) => ({ default: module.ProjectsListPage })),
)

const ProjectEditorPage = lazy(() =>
  import('../pages/project-editor-page').then((module) => ({ default: module.ProjectEditorPage })),
)

const ProjectDetailPage = lazy(() =>
  import('../pages/project-detail-page').then((module) => ({ default: module.ProjectDetailPage })),
)

const TranslationMemoriesListPage = lazy(() =>
  import('../pages/translation-memories-list-page').then((module) => ({
    default: module.TranslationMemoriesListPage,
  })),
)

const TranslationMemoryEditorPage = lazy(() =>
  import('../pages/translation-memory-editor-page').then((module) => ({
    default: module.TranslationMemoryEditorPage,
  })),
)

const TranslationMemoryDetailPage = lazy(() =>
  import('../pages/translation-memory-detail-page').then((module) => ({
    default: module.TranslationMemoryDetailPage,
  })),
)

const GlossariesListPage = lazy(() =>
  import('../pages/glossaries-list-page').then((module) => ({
    default: module.GlossariesListPage,
  })),
)

const GlossaryEditorPage = lazy(() =>
  import('../pages/glossary-editor-page').then((module) => ({
    default: module.GlossaryEditorPage,
  })),
)

const GlossaryDetailPage = lazy(() =>
  import('../pages/glossary-detail-page').then((module) => ({
    default: module.GlossaryDetailPage,
  })),
)

const SettingsPage = lazy(() =>
  import('../pages/settings-page').then((module) => ({ default: module.SettingsPage })),
)

export const appRouter = createBrowserRouter([
  {
    path: '/',
    element: <DashboardLayout />,
    children: [
      {
        index: true,
        element: (
          <PlaceholderPage
            eyebrow="Overview"
            title="Workspace overview is coming next."
            description="Use the translator page to process documents today. This overview route is ready for dashboard metrics and recent activity."
          />
        ),
      },
      {
        path: 'translator',
        element: <TranslatorPage />,
      },
      {
        path: 'projects',
        element: <ProjectsListPage />,
      },
      {
        path: 'projects/new',
        element: <ProjectEditorPage />,
      },
      {
        path: 'projects/:projectId',
        element: <ProjectDetailPage />,
      },
      {
        path: 'projects/:projectId/edit',
        element: <ProjectEditorPage />,
      },
      {
        path: 'translation-memories',
        element: <TranslationMemoriesListPage />,
      },
      {
        path: 'translation-memories/new',
        element: <TranslationMemoryEditorPage />,
      },
      {
        path: 'translation-memories/:translationMemoryId',
        element: <TranslationMemoryDetailPage />,
      },
      {
        path: 'translation-memories/:translationMemoryId/edit',
        element: <TranslationMemoryEditorPage />,
      },
      {
        path: 'glossaries',
        element: <GlossariesListPage />,
      },
      {
        path: 'glossaries/new',
        element: <GlossaryEditorPage />,
      },
      {
        path: 'glossaries/:glossaryId',
        element: <GlossaryDetailPage />,
      },
      {
        path: 'glossaries/:glossaryId/edit',
        element: <GlossaryEditorPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
    ],
  },
])

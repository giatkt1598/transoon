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
        path: 'translation-memories/:translationMemoryId/edit',
        element: <TranslationMemoryEditorPage />,
      },
      {
        path: 'analytics',
        element: (
          <PlaceholderPage
            eyebrow="Analytics"
            title="Translation analytics can plug in here."
            description="You can add provider performance, throughput, segment counts, and failure trends on this page later."
          />
        ),
      },
      {
        path: 'templates',
        element: (
          <PlaceholderPage
            eyebrow="Templates"
            title="Prompt and workflow templates belong here."
            description="This route is ready for reusable translation presets, glossary packs, and document handling profiles."
          />
        ),
      },
      {
        path: 'imports',
        element: (
          <PlaceholderPage
            eyebrow="Imports"
            title="Bulk import tools can grow here."
            description="Use this page later for batched uploads, queueing, and source system connectors."
          />
        ),
      },
      {
        path: 'providers',
        element: (
          <PlaceholderPage
            eyebrow="Providers"
            title="Provider management is ready for expansion."
            description="This route can host model availability, prompt previews, and environment-level provider configuration."
          />
        ),
      },
      {
        path: 'settings',
        element: (
          <PlaceholderPage
            eyebrow="Settings"
            title="Workspace settings will go here."
            description="Add storage, export defaults, and UI preferences here when you're ready."
          />
        ),
      },
    ],
  },
])

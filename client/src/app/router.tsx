import { lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { DashboardLayout } from '../layouts/dashboard-layout'

const PlaceholderPage = lazy(() =>
  import('../pages/placeholder-page').then((module) => ({ default: module.PlaceholderPage })),
)

const TranslatorPage = lazy(() =>
  import('../pages/translator-page').then((module) => ({ default: module.TranslatorPage })),
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
        path: 'documents',
        element: (
          <PlaceholderPage
            eyebrow="Documents"
            title="Document history will live here."
            description="This route is ready for upload history, file filtering, and downloadable translation outputs."
          />
        ),
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

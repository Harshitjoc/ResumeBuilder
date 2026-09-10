import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-6">
          <h1 className="mb-2 text-lg font-semibold text-slate-900">Something went wrong</h1>
          <p className="mb-4 text-sm text-slate-600">An unexpected error occurred while rendering this page.</p>
          <pre className="overflow-x-auto rounded-lg bg-slate-100 p-4 text-xs text-red-600">{this.state.error.message}</pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Reload page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
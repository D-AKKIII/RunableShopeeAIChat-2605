import React from 'react';

export class ErrorBoundary extends React.Component<{children: React.ReactNode}, {error: string|null}> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    if (this.state.error) {
      return <div style={{padding: 20, background: 'red', color: 'white'}}>
        <h1>Error on this page:</h1>
        <pre>{this.state.error}</pre>
      </div>;
    }
    return this.props.children;
  }
}

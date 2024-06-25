declare function acquireVsCodeApi(): {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
};

interface Window {
  acquireVsCodeApi: typeof acquireVsCodeApi;
}

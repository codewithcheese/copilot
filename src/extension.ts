import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const provider = new SidebarProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, provider)
  );

  // Register the command that will open the webview
  let disposable = vscode.commands.registerCommand('codewithcheese.new-chat', () => {
    vscode.commands.executeCommand('workbench.view.extension.codewithcheese');
  });

  context.subscriptions.push(disposable);
}

class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'codewithcheese';

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(message => {
      switch (message.command) {
        case 'alert':
          vscode.window.showInformationMessage(message.text);
          return;
      }
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Sidebar Webview</title>
            </head>
            <body>
                <h1>Hello from the sidebar!</h1>
                <button id="helloButton">Say Hello</button>
                <script>
                    const vscode = acquireVsCodeApi();
                    document.getElementById('helloButton').addEventListener('click', () => {
                        vscode.postMessage({
                            command: 'alert',
                            text: 'Hello from the webview!'
                        });
                    });
                </script>
            </body>
            </html>`;
  }
}

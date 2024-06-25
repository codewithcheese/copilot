import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel("Codewithcheese");
  outputChannel.appendLine("Codewithcheese activated!");
  const provider = new SidebarProvider(context.extensionUri, outputChannel);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SidebarProvider.viewType,
      provider
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("codewithcheese.openSidebar", () => {
      vscode.commands.executeCommand("workbench.view.extension.codewithcheese");
    })
  );

  // New command to open chat panel
  context.subscriptions.push(
    vscode.commands.registerCommand("codewithcheese.openChatPanel", () => {
      const panel = vscode.window.createWebviewPanel(
        "chatPanel",
        "Chat",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [context.extensionUri],
        }
      );

      panel.webview.html = getChatWebviewContent(
        panel.webview,
        context.extensionUri
      );
    })
  );

  // Set up file watcher
  // const webviewPath = path.join(context.extensionPath, "dist", "ui", "sidebar");
  // const watcher = vscode.workspace.createFileSystemWatcher(
  //   new vscode.RelativePattern(webviewPath, "**/*")
  // );
  //
  // watcher.onDidChange((uri) => {
  //   outputChannel.appendLine(`File changed: ${uri.fsPath}`);
  //   provider.reload();
  // });
  //
  // watcher.onDidCreate((uri) => {
  //   outputChannel.appendLine(`File created: ${uri.fsPath}`);
  //   provider.reload();
  // });
  //
  // watcher.onDidDelete((uri) => {
  //   outputChannel.appendLine(`File deleted: ${uri.fsPath}`);
  //   provider.reload();
  // });
  //
  // context.subscriptions.push(watcher);
}

class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "codewithcheese.sidebar";
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly outputChannel: vscode.OutputChannel
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage((message) => {
      this.outputChannel.appendLine(
        `Received message from webview: ${JSON.stringify(message)}`
      );
      switch (message.command) {
        case "alert":
          vscode.window.showInformationMessage(message.text);
          return;
        case "openChatPanel":
          vscode.commands.executeCommand("codewithcheese.openChatPanel");
          return;
      }
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        "dist",
        "ui",
        "sidebar",
        "index.js"
      )
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        "dist",
        "ui",
        "sidebar",
        "index.css"
      )
    );

    return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleUri}" rel="stylesheet">
                <title>Codewithcheese</title>
            </head>
            <body>
                <div id="app"></div>
                <script src="${scriptUri}"></script>
            </body>
            </html>`;
  }
}

function getChatWebviewContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri
) {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "dist", "ui", "chat", "index.js")
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "dist", "ui", "chat", "index.css")
  );

  return `<!DOCTYPE html>
          <html lang="en">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <link href="${styleUri}" rel="stylesheet">
              <title>Chat</title>
          </head>
          <body>
              <div id="app"></div>
              <script src="${scriptUri}"></script>
          </body>
          </html>`;
}

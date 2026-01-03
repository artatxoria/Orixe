import * as vscode from 'vscode';
import axios from 'axios';

export class OrixeChatProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'orixe.chatView';
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlContent();

        // NUEVO: Escuchar mensajes desde el HTML del Webview
        webviewView.webview.onDidReceiveMessage(async (data) => {
            if (data.type === 'sendPrompt') {
                this.handleChat(data.value);
            }
        });
    }

    // NUEVO: Lógica para hablar con el backend y devolver la respuesta al HTML
    private async handleChat(prompt: string) {
        if (!this._view) return;

        // 1. Mostrar mensaje del usuario en el chat
        this._view.webview.postMessage({ type: 'addMessage', role: 'user', text: prompt });

        try {
            // 2. Llamar al backend (igual que hacías en extension.ts)
            const response = await axios.post('http://localhost:3000/chat', { prompt });
            const { source, text } = response.data;

            // 3. Enviar respuesta de la IA al HTML
            this._view.webview.postMessage({ 
                type: 'addMessage', 
                role: 'ai', 
                text: `[${source.toUpperCase()}]: ${text}` 
            });
        } catch (error) {
            this._view.webview.postMessage({ 
                type: 'addMessage', 
                role: 'error', 
                text: 'Error: No puedo conectar con el backend.' 
            });
        }
    }

    private _getHtmlContent() {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: var(--vscode-font-family); padding: 10px; color: var(--vscode-foreground); }
                    #chat { height: calc(100vh - 80px); overflow-y: auto; padding: 5px; }
                    .msg { margin-bottom: 10px; padding: 5px; border-radius: 4px; }
                    .user { background: var(--vscode-button-secondaryBackground); border-left: 3px solid cyan; }
                    .ai { background: var(--vscode-editor-background); border-left: 3px solid lime; }
                    .error { color: var(--vscode-errorForeground); font-size: 0.8em; }
                    input { width: 100%; position: fixed; bottom: 10px; left: 0; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 8px; }
                </style>
            </head>
            <body>
                <div id="chat"></div>
                <input type="text" id="prompt" placeholder="Escribe a Orixe..." />
                
                <script>
                    const vscode = acquireVsCodeApi();
                    const chatDiv = document.getElementById('chat');
                    const input = document.getElementById('prompt');

                    // Enviar al pulsar Enter
                    input.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter' && input.value.trim()) {
                            vscode.postMessage({ type: 'sendPrompt', value: input.value });
                            input.value = '';
                        }
                    });

                    // Recibir mensajes desde la extensión
                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.type === 'addMessage') {
                            const div = document.createElement('div');
                            div.className = 'msg ' + message.role;
                            div.innerText = message.text;
                            chatDiv.appendChild(div);
                            chatDiv.scrollTop = chatDiv.scrollHeight;
                        }
                    });
                </script>
            </body>
            </html>
        `;
    }
}
import * as vscode from 'vscode';
import axios from 'axios';
import { marked } from 'marked';

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

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'sendPrompt':
                    this.handleChat(data.value);
                    break;
                case 'insertCode':
                    this.insertCodeAtCursor(data.value);
                    break;
            }
        });
    }

    private insertCodeAtCursor(code: string) {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            editor.edit(editBuilder => {
                // Inserta el código en la posición actual del cursor (o reemplaza selección)
                editBuilder.insert(editor.selection.active, code);
            });
            vscode.window.showInformationMessage('Código inyectado por Orixe');
        } else {
            vscode.window.showErrorMessage('Abre un archivo para insertar el código.');
        }
    }

    private async handleChat(prompt: string) {
        if (!this._view) return;

        const editor = vscode.window.activeTextEditor;
        let contextCode = "";

        const projectMap = await this.getProjectStructure();

        const diagnostics = this.getDiagnostics();
        
        if (editor) {
            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);
            const languageId = editor.document.languageId;
            
            if (selectedText) {
                contextCode = `\n\nContexto (selección en ${languageId}):\n\`\`\`${languageId}\n${selectedText}\n\`\`\``;
            } else {
                const fullText = editor.document.getText();
                const previewText = fullText.length > 5000 ? fullText.substring(0, 5000) + "...[truncado]" : fullText;
                contextCode = `\n\nContexto (archivo ${languageId}):\n\`\`\`${languageId}\n${previewText}\n\`\`\``;
            }
        }

        this._view.webview.postMessage({ type: 'addMessage', role: 'user', text: prompt });

        try {
            const fullPrompt = `MAPA DEL PROYECTO:\n${projectMap}\n\n${diagnostics}\n\n${contextCode}\n\nPREGUNTA: ${prompt}`;
        
            const response = await axios.post('http://127.0.0.1:3000/chat', { prompt: fullPrompt });
            
            const { source, text } = response.data;
            const htmlFromMarkdown = await marked.parse(text);
            
            this._view.webview.postMessage({ 
                type: 'addMessage', 
                role: 'ai', 
                text: `<strong>[${source.toUpperCase()}]</strong><br>${htmlFromMarkdown}` 
            });

        } catch (error) {
            this._view.webview.postMessage({ 
                type: 'addMessage', 
                role: 'error', 
                text: 'Error: El backend no responde.' 
            });
        }
    }

    private _getHtmlContent() {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src http://127.0.0.1:3000 http://localhost:3000;">
                <style>
                    body { font-family: var(--vscode-font-family); padding: 10px; color: var(--vscode-foreground); margin: 0; }
                    #chat { height: calc(100vh - 120px); overflow-y: auto; padding: 10px; display: flex; flex-direction: column; }
                    .msg { margin-bottom: 15px; padding: 10px; border-radius: 6px; line-height: 1.5; font-size: 13px; position: relative; }
                    .user { background: var(--vscode-button-secondaryBackground); border-left: 4px solid #007acc; align-self: flex-end; width: 85%; }
                    .ai { background: var(--vscode-welcomePage-tileBackground); border-left: 4px solid #388a34; align-self: flex-start; width: 85%; }
                    pre { background: #1e1e1e; padding: 12px; overflow-x: auto; border-radius: 4px; position: relative; margin-top: 10px; }
                    code { font-family: var(--vscode-editor-font-family); color: #dcdcdc; }
                    .insert-btn { 
                        display: block; margin-top: 8px; padding: 4px 8px; background: #388a34; color: white; 
                        border: none; border-radius: 3px; cursor: pointer; font-size: 11px; font-weight: bold;
                    }
                    .insert-btn:hover { background: #2d6d2a; }
                    input { width: calc(100% - 20px); position: fixed; bottom: 15px; left: 10px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 10px; border-radius: 4px; outline: none; }
                </style>
            </head>
            <body>
                <div id="chat"></div>
                <input type="text" id="prompt" placeholder="Pregunta algo al código..." autofocus />
                <script>
                    const vscode = acquireVsCodeApi();
                    const chatDiv = document.getElementById('chat');
                    const input = document.getElementById('prompt');

                    input.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter' && input.value.trim()) {
                            vscode.postMessage({ type: 'sendPrompt', value: input.value });
                            input.value = '';
                        }
                    });

                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.type === 'addMessage') {
                            const div = document.createElement('div');
                            div.className = 'msg ' + message.role;
                            div.innerHTML = message.text;

                            // Si es respuesta de la IA, buscamos bloques de código para añadir el botón "Insertar"
                            if (message.role === 'ai') {
                                const codeBlocks = div.querySelectorAll('pre');
                                codeBlocks.forEach(block => {
                                    const codeElement = block.querySelector('code');
                                    if (codeElement) {
                                        const btn = document.createElement('button');
                                        btn.className = 'insert-btn';
                                        btn.innerText = '⇥ Insertar en editor';
                                        btn.onclick = () => {
                                            vscode.postMessage({ type: 'insertCode', value: codeElement.innerText });
                                        };
                                        block.appendChild(btn);
                                    }
                                });
                            }

                            chatDiv.appendChild(div);
                            chatDiv.scrollTop = chatDiv.scrollHeight;
                        }
                    });
                </script>
            </body>
            </html>
        `;
    }

    private async getProjectStructure(): Promise<string> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return "No hay un workspace abierto.";

        // Buscamos todos los archivos, pero ignoramos carpetas pesadas
        const files = await vscode.workspace.findFiles(
            '**/*', 
            '{**/node_modules/**,**/dist/**,**/.git/**,**/out/**}'
        );

        const structure = files.map(f => vscode.workspace.asRelativePath(f)).sort();
        return "Estructura del proyecto:\n- " + structure.join('\n- ');
    }

    private getDiagnostics(): string {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return "";

        // Obtenemos los errores/warnings del archivo actual
        const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
        
        if (diagnostics.length === 0) return "No se detectaron errores en el archivo actual.";

        const errorList = diagnostics
            .map(d => {
                const severity = vscode.DiagnosticSeverity[d.severity];
                return `[${severity}] Línea ${d.range.start.line + 1}: ${d.message}`;
            })
            .join('\n');

        return `DIAGNÓSTICOS DEL COMPILADOR:\n${errorList}`;
}



}
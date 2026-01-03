import * as vscode from 'vscode';
import axios from 'axios';
import { OrixeChatProvider } from './OrixeChatProvider';

export function activate(context: vscode.ExtensionContext) {
    
    // --- 1. REGISTRO DEL PANEL LATERAL (ETAPA 06) ---
    const provider = new OrixeChatProvider(context.extensionUri);
    
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(OrixeChatProvider.viewType, provider)
    );

    // --- 2. COMANDO CLÁSICO DE SALUDO (TU CÓDIGO ACTUAL) ---
    let disposable = vscode.commands.registerCommand('orixe.helloWorld', async () => {
        
        // 1. Pedir una pregunta al usuario
        const userPrompt = await vscode.window.showInputBox({
            prompt: "Pregunta a Orixe IA...",
            placeHolder: "Ej: ¿Cómo hago un bucle en Python?"
        });

        if (!userPrompt) return; 

        // 2. Mostrar mensaje de "Pensando..."
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Orixe está pensando...",
            cancellable: false
        }, async () => {
            try {
                // 3. Llamar a nuestro backend orquestador
                const response = await axios.post('http://localhost:3000/chat', {
                    prompt: userPrompt
                });

                const { source, text } = response.data;

                // 4. Mostrar la respuesta
                vscode.window.showInformationMessage(`[${source.toUpperCase()}]: ${text}`, { modal: true });

            } catch (error) {
                vscode.window.showErrorMessage("Error: El cerebro de Orixe no responde.");
            }
        });
    });

    context.subscriptions.push(disposable);
    
    console.log('Orixe AI: Extension activa con Panel Lateral y Comandos.');
}

export function deactivate() {}
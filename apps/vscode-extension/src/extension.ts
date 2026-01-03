import * as vscode from 'vscode';
import axios from 'axios';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('orixe.helloWorld', async () => {
        
        // 1. Pedir una pregunta al usuario
        const userPrompt = await vscode.window.showInputBox({
            prompt: "Pregunta a Orixe IA...",
            placeHolder: "Ej: ¿Cómo hago un bucle en Python?"
        });

        if (!userPrompt) return; // Si cancela con Esc

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

                // 4. Mostrar la respuesta en un panel lateral o mensaje
                // Por ahora, un mensaje de información grande:
                vscode.window.showInformationMessage(`[${source.toUpperCase()}]: ${text}`, { modal: true });

            } catch (error) {
                vscode.window.showErrorMessage("Error: El cerebro de Orixe no responde.");
            }
        });
    });

    context.subscriptions.push(disposable);
}
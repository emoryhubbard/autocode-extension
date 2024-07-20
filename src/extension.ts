import { Server } from 'http';
import * as vscode from 'vscode';
import express, { Express, Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { promisify } from 'util';
import { resolve } from 'path';
import { get, getRelativeFilePath, getServer } from './utils';

dotenv.config();
let server: Server;
let activeEditor: vscode.TextEditor | undefined;
let chatEditor: vscode.TextEditor | undefined;
let firstChange = true;

export function activate(context: vscode.ExtensionContext) {
	let webview = vscode.commands.registerCommand('autocode.openChat', () => {

    activeEditor = vscode.window.activeTextEditor;
    firstChange = true;

		let panel = vscode.window.createWebviewPanel(
      'autocodeChat',
			'Autocode: Chat',
      vscode.ViewColumn.One,
      {
			  enableScripts: true
		  }
    )

		let scriptSrc = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "web", "dist", "index.js"))

		let cssSrc = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "web", "dist", "index.css"))

		panel.webview.html = `<!DOCTYPE html>
        <html lang="en">
          <head>
            <link rel="stylesheet" href="${cssSrc}" />
          </head>
          <body>
            <noscript>You need to enable JavaScript to run this app.</noscript>
            <div id="root" class=""></div>
            <script src="${scriptSrc}"></script>
          </body>
        </html>
        `

      
    if (!server) {
      function getCurrentFolder(): string | undefined {
        //const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            console.log("No active editor.");
            return;
        }

        const currentFilePath = activeEditor.document.fileName;
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (workspaceFolders) {
            for (const folder of workspaceFolders) {
                const folderPath = folder.uri.fsPath;
                // Check if the current file path starts with the folder path
                if (currentFilePath.startsWith(folderPath)) {
                    //console.log("Current folder: " + folderPath);
                    return folderPath;
                }
            }
        }

        console.log("No matching workspace folder found.");
        return;
      }
      function getCurrentTab(): string {
        //console.log("Current tab: " + (vscode.window.activeTextEditor? vscode.window.activeTextEditor.document.fileName : "No active editor"));
        return activeEditor? activeEditor.document.fileName : "No active editor";
        //return vscode.window.activeTextEditor? vscode.window.activeTextEditor.document.fileName : "No active editor";
      }

      function getCurrentTabFileContents(): string {
        //console.log("Current tab: " + (vscode.window.activeTextEditor? vscode.window.activeTextEditor.document.fileName : "No active editor"));
        return activeEditor? fs.readFileSync(activeEditor.document.fileName, "utf-8"): "No active editor";
        //return vscode.window.activeTextEditor? vscode.window.activeTextEditor.document.fileName : "No active editor";
      }
      function getCurrentCursorPosition() {
        const editor = activeEditor;
        if (editor) {
          const position = editor.selection.active; // `active` gives the position of the cursor
          console.log(`Current cursor position: Line ${position.line} Character ${position.character}`);
          return position;
        } else {
          console.log('No active editor');
          return null;
        }
      }
      function writeFile(filePath: string, fileContents: string): void {
        fs.writeFileSync(filePath, fileContents);
      }
      function log(msg: string) {
        console.log(msg);
      }
      function findFileNames(text: string): string[] {
        // Regular expression to match filenames with extensions
        // This pattern looks for sequences of characters that do not contain spaces or slashes,
        // followed by a dot, and ending with one or more characters (the extension).
        const regex = /\b[\w.-]+?\.\w+\b/g;
        const matches = text.match(regex);
        return matches || [];
      }
      
      function findFilePaths(fileName: string, absoluteDirPath: string): string[] {
        let filePaths: string[] = [];
        const excludeDirs = ['node_modules', '.git', '.vscode', '.next', 'dist', 'build', 'public', 'coverage', 'temp', 'tmp', 'logs', 'log', 'bin', 'out', 'target'];
        
        function searchDirectory(directory: string) {
          const items = fs.readdirSync(directory, { withFileTypes: true });
          for (const item of items) {
            if (item.isDirectory()) {
              if (!excludeDirs.includes(item.name)) {
                searchDirectory(path.join(directory, item.name));
              }
            } else if (item.isFile()) {
              if (item.name === fileName) {
                filePaths.push(path.join(directory, item.name));
              }
            }
          }
        }
      
        searchDirectory(absoluteDirPath);
        return filePaths;
      }
      
      function getFiles(description: string): { fileName: string; filePath: string; fileContents: string; isTarget: boolean; }[] {
        const fileNames = findFileNames(description);
        const currentFolder = getCurrentFolder()!; // If this is undefined, we want to throw an error
        let nonTargetFiles: { fileName: string; filePath: string; fileContents: string; isTarget: boolean; }[] = [];
        fileNames.map(fileName => {
          const filePaths = findFilePaths(fileName, currentFolder);
          if (filePaths.length > 0) {
            nonTargetFiles.push({
              fileName: fileName,
              filePath: getRelativeFilePath(currentFolder, filePaths[0]),
              fileContents: '',
              isTarget: false
            });
          }
        });
        return nonTargetFiles;
      }

      server = getServer(getCurrentFolder, getCurrentTab, getCurrentTabFileContents, getCurrentCursorPosition, log, getFiles, writeFile);

      async function testEndpoints() {
        console.log("Calling first endpoint: " + await get(`http://localhost:${process.env.PORT}/get-current-folder`));
        console.log("Calling second endpoint: " + await get(`http://localhost:${process.env.PORT}/get-current-tab`));
        console.log("Calling third endpoint: " + await get(`http://localhost:${process.env.PORT}/log`, {msg: "Hello, world!"}));
      }
      
      testEndpoints();
    }
	});

	context.subscriptions.push(webview);

  let disposable = vscode.window.onDidChangeActiveTextEditor(editor => {
    if (firstChange) {
      chatEditor = editor;
      console.log('Setting chatEditor');
      firstChange = false;
    }
    if (editor == chatEditor) {
      console.log('Active editor changed but it is to chatEditor so not changing activeEditor');
    }
    if (editor != chatEditor) {
      console.log('Active editor changed');
      activeEditor = editor;
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {
  if (server)
    server.close();
}
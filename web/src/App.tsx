import React, { FormEvent, FormEventHandler, useEffect, useRef, useState } from 'react';
import {
  VSCodeButton,
  VSCodeTextField,
  VSCodeProgressRing,
  VSCodeTextArea,
  VSCodeBadge,
  VSCodeDivider,
} from "@vscode/webview-ui-toolkit/react";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { get, getFileName, getRelativeFilePath, last, post } from './utils'; 
import path from "path";
import fs from "fs";
import dotenv from 'dotenv';

dotenv.config();

function App() {
  const [description, setDescription] = useState('');
  const [maxAttempts, setMaxAttempts] = useState('');
  const [autoInserting, setAutoInserting] = useState(false);
  const [testURL, setTestURL] = useState(''); 
  const [messages, setMessages] = useState<string[][]>([]);
  const [generating, setGenerating] = useState(false);

  const endOfMessagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (endOfMessagesRef.current)
      (endOfMessagesRef.current).scrollIntoView({ behavior: "smooth" });
  }, [messages]); // Dependency array includes messages to trigger scroll on update

  const handleManualInsert = async () => {
    if (description == '' && messages.length > 0 && last(messages)[0] == "Successfully generated the following code: ") {
      const currentTab = await get(`http://localhost:${process.env.PORT}/get-current-tab`);
      const fileContents = await get(`http://localhost:${process.env.PORT}/get-current-tab-file-contents`);

      const newMessages = [];
      newMessages.push([description]);
      const autocodeMessage = [];
      let response;
      try {
        console.log("Request: ", { existingFile: fileContents, codeSnippet: last(messages)[1], filePath: currentTab});
        response = await post(`http://localhost:${process.env.AUTOCODE_PORT}/api/auto-insert`,
          { existingFile: fileContents, codeSnippet: last(messages)[1], filePath: currentTab});
        console.log('Post response: ', response);
      } catch (error) {
        if (!response)
          autocodeMessage.push('Auto-insert endpoint failed to respond and a network error was thrown: ' + error);
      }
      setDescription('');
      newMessages.push(autocodeMessage);
      setMessages([...messages, ...newMessages]);
    }
  };

  const handleAutoInsert = async () => {
    if (description == '' && messages.length > 0 && last(messages)[0] == "Successfully generated the following code: ") {
      const currentTab = await get(`http://localhost:${process.env.PORT}/get-current-tab`);
      const fileContents = await get(`http://localhost:${process.env.PORT}/get-current-tab-file-contents`);


      setAutoInserting(true);
      const newMessages = [];
      newMessages.push([description]);
      const autocodeMessage = [];
      let response;
      try {
        console.log("Request: ", { existingFile: fileContents, codeSnippet: last(messages)[1], filePath: currentTab});
        response = await post(`http://localhost:${process.env.AUTOCODE_PORT}/api/auto-insert`,
          { existingFile: fileContents, codeSnippet: last(messages)[1], filePath: currentTab});
        console.log('Post response: ', response);
      } catch (error) {
        if (!response)
          autocodeMessage.push('Auto-insert endpoint failed to respond and a network error was thrown: ' + error);
      }

      try {
        if (response && !response.internalError)
          autocodeMessage.push('Integrated the previous code snippet.');
        if (response && response.internalError)
          autocodeMessage.push('Error within auto-insert endpoint: ' + response.internalError);
      } catch (error) {
        if (response) // not really necessary, but just in case the returned data expands in the future
          autocodeMessage.push('Response from auto-insert endpoint is missing data: ' + error);
      }
      setAutoInserting(false);
      setDescription('');
      newMessages.push(autocodeMessage);
      setMessages([...messages, ...newMessages]);
    }

    if (description != '') {
      const currentFolder = await get(`http://localhost:${process.env.PORT}/get-current-folder`);
      const currentTab = await get(`http://localhost:${process.env.PORT}/get-current-tab`);
      let nonTargetFiles = await get(`http://localhost:${process.env.PORT}/get-files`, { description: description });
      nonTargetFiles = nonTargetFiles.filter((file: { fileName: string; filePath: string; fileContents: string; isTarget: boolean; }) => {
        return !(file.fileName === getFileName(currentTab));
      });
      const feature = {
        description: '',
        steps: [
          { description: description,
            target: getFileName(currentTab),
            files: [
              {
                "fileName": getFileName(currentTab),
                "filePath": getRelativeFilePath(currentFolder, currentTab),
                "fileContents": "// Content of page.jsx file",
                "isTarget": true
              }, ...nonTargetFiles
            ],
            testPath: testURL,
            maxAttempts: maxAttempts,
            showHTML: "false",
          }
        ]
      };
      console.log('Feature:', feature);

      setAutoInserting(true);
      const newMessages = [];
      newMessages.push([description]);
      const autocodeMessage = [];
      let response;
      try {
        response = await post(`http://localhost:${process.env.AUTOCODE_PORT}/api/execute-steps`, { feature });
        console.log('Post response: ', response);
      } catch (error) {
        if (!response)
          autocodeMessage.push('Execute-steps endpoint failed to respond and a network error was thrown: ' + error);
      }
      try {
        if (response && response.passing) {
          autocodeMessage.push('Succesfully integrated and tested the following code: ');
          autocodeMessage.push(last(response.stepResponses).lastTrimmedCode);
          autocodeMessage.push('Last test results: ' + last(last(response.stepResponses).passingResponses));
        }
        if (response && !response.passing && !response.internalError) {// keep this in mind when looking at the catch block, tricky
          autocodeMessage.push('Failed to debug the following code: ');
          autocodeMessage.push(last(response.stepResponses).lastTrimmedCode);
          autocodeMessage.push('Last test results: ' + last(last(response.stepResponses).passingResponses));
        }
        if (response && !response.passing && response.internalError)
          autocodeMessage.push('Error within execute-steps endpoint: ' + response.internalError);
      } catch (error) {
        if (response) // even though the condition to be kept in mind above could pass, data eg. stepResponses was missing
          autocodeMessage.push('Response from execute-steps endpoint is missing data: ' + error);
      }
      setAutoInserting(false);
      setDescription('');
      newMessages.push(autocodeMessage);
      setMessages([...messages, ...newMessages]);
    }
  };

  const handleGenerate = async () =>  {
    const currentFolder = await get(`http://localhost:${process.env.PORT}/get-current-folder`);
    const currentTab = await get(`http://localhost:${process.env.PORT}/get-current-tab`);
    let nonTargetFiles = await get(`http://localhost:${process.env.PORT}/get-files`, { description: description });
    nonTargetFiles = nonTargetFiles.filter((file: { fileName: string; filePath: string; fileContents: string; isTarget: boolean; }) => {
      return !(file.fileName === getFileName(currentTab));
    });
    const feature = {
      description: '',
      steps: [
        { description: description,
          target: getFileName(currentTab),
          files: [
            {
              "fileName": getFileName(currentTab),
              "filePath": getRelativeFilePath(currentFolder, currentTab),
              "fileContents": "// Content of page.jsx file",
              "isTarget": true
            }, ...nonTargetFiles
          ],
          testPath: testURL,
          maxAttempts: maxAttempts,
          showHTML: "false",
        }
      ]
    };
    console.log('Feature:', feature);

    setGenerating(true);
    const newMessages = [];
    newMessages.push([description]);
    const autocodeMessage = [];
    let response;
    try {
      response = await post(`http://localhost:${process.env.AUTOCODE_PORT}/api/generate`, { feature });
      console.log('Post response: ', response);
    } catch (error) {
      if (!response)
        autocodeMessage.push('Generate endpoint failed to respond and a network error was thrown: ' + error);
    }
    try {
      if (response && !response.internalError) {
        autocodeMessage.push('Successfully generated the following code: ');
        autocodeMessage.push(response.trimmedCode);
      }
      if (response && response.internalError)
        autocodeMessage.push('Error within generate endpoint: ' + response.internalError);
    } catch (error) {
      if (response) // even though the condition to be kept in mind above could pass, data eg. trimmedCode was missing
        autocodeMessage.push('Response from generate endpoint is missing data: ' + error);
    }
    setGenerating(false);
    setDescription('');
    newMessages.push(autocodeMessage);
    setMessages([...messages, ...newMessages]);
  };
  
  let isUser = false;
  return (
    <div className="grid gap-3 p-2 place-items-start">
      {messages.map((message, index) => {
        isUser = !isUser;
        return (<>
          <VSCodeBadge key={index} className="">{isUser? "User": "Autocode"}</VSCodeBadge>
          <p>{message[0]}</p>
          {(message.length > 1)?
            (<SyntaxHighlighter className="!bg-[#3c3c3c]" language="javascript" style={vscDarkPlus}>{message[1]}</SyntaxHighlighter>): ""}
          {(message.length > 2)?
            <p>{message[2]}</p>: ""}
          <VSCodeDivider className={"h-[1px] bg-gray-700 " + ((index == (messages.length - 1))? "hidden": "")}></VSCodeDivider>
      </>);
      })}
      <div ref={endOfMessagesRef}></div> {/* Invisible element to mark the end */}
      <VSCodeTextArea className="w-[30rem]" value={description}
        onInput={(e) => setDescription((e.target as HTMLInputElement).value)}></VSCodeTextArea>
      <div className="grid gap-3 p-2 grid-flow-col w-[30rem]">
        <VSCodeButton onClick={handleAutoInsert} className={"w-[110px] mr-[-16px] " + (autoInserting? "bg-blue-900": "")}>
          {autoInserting? <VSCodeProgressRing className="h-[14px] w-[14px]"></VSCodeProgressRing>: "Auto-Insert"}
        </VSCodeButton>
        <VSCodeButton onClick={handleManualInsert}>Manual-Insert</VSCodeButton>
        <VSCodeButton onClick={handleGenerate} className={"w-[110px] mr-[-16px] " + (generating? "bg-blue-900": "")}>
          {generating? <VSCodeProgressRing className="h-[14px] w-[14px]"></VSCodeProgressRing>: "Generate"}
        </VSCodeButton>
        <VSCodeButton>Add Step</VSCodeButton>
      </div>
      <VSCodeTextField value={maxAttempts} onChange={(e) => setMaxAttempts((e.target as HTMLInputElement).value)}>Max Test Attempts:</VSCodeTextField>
      <VSCodeTextField value={testURL} onChange={(e) => setTestURL((e.target as HTMLInputElement).value)}>Test URL: </VSCodeTextField>
    </div>
  );
}

export default App;
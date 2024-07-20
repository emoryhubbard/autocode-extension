import { Server } from 'http';
import express, { Express, Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export async function fastFetch(url: string, data: { [key: string]: any } | null = null, post: boolean = false): Promise<any> {
    let response;
    let requestOptions: RequestInit;

    if (post) {
        requestOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: data? JSON.stringify(data): ''
        };
    } else if (data) {
        const params = new URLSearchParams(data);
        url += `?${params.toString()}`;
        requestOptions = {
            method: 'GET'
        };
    } else {
        requestOptions = {
            method: 'GET'
        };
    }

    try {
        //console.log("URL: ", url);
        //console.log("RequestOptions: ", JSON.stringify(requestOptions));
        response = await fetch(url, requestOptions);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        let resultData;
        try {
            resultData = await response.json();
        } catch (error) {
            console.error('Error parsing JSON:', error);
            console.log("Note that if this endpoint was built with getServer(), this error may be normal behavior if the function had no return value.");
            resultData = {};
        }
        return resultData;
    } catch (error) {
        console.error('Error fetching data:', error);
        throw error;
    }
}
  
export async function post(url: string, data: {[key: string]: any;}): Promise<any> {
    return fastFetch(url, data, true);
}

/*  Data example:
    let data: {[key: string]: any} = {
        "name": "John Doe",
        "age": 30,
        "isEmployed": true,
        "address": {
            "street": "123 Main St",
            "city": "Anytown"
        },
        "hobbies": ["reading", "traveling", "coding"]
    };
*/
export async function get(url: string, data: {[key: string]: any;} | null = null): Promise<any> {
    return fastFetch(url, data, false);
}

// get(`http://localhost:${process.env.PORT}/my-function`) will call `myFunction` and return the result
export function getServer(...functions: Function[]): Server {
    const app: Express = express();
    app.use(express.json());

    // Set CORS headers to allow all origins
    app.use((req: Request, res: Response, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        next();
    });

    // Create endpoints for each function
    functions.forEach(func => {
        //console.log(func.name);
        const endpoint = `/${camelToKebabCase(func.name)}`;
        //console.log(endpoint);
        app.get(endpoint, async (req: Request, res: Response) => {
        try {
            let result;
            if (func.length !== 0) {
                const paramNames = getFunctionParameterNames(func);
                const args = paramNames.map(name => req.query[name]);
                result = await func(...args);
            }
            if (func.length === 0)
                result = await func();
            //const result = func.length === 1 ? await func(req.query): await func();
            //console.log("Result of function/endpoint " + func.name + "before sending response:", result);
            res.status(200).json(result);
        } catch (error) {
            console.error(`Error at ${endpoint}:`, error);
            res.status(500).json({ error: 'Internal server error' });
        }
        });
    });

    //console.log("Testing port: " + process.env.PORT);
    // Start the server
    const port = parseInt(process.env.PORT || "3000");
    const server = app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });

    return server;
}

function camelToKebabCase(str: string): string {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function getFunctionParameterNames(func: Function): string[] {
    const match = func.toString().match(/\(.*?\)/);
    const result = match ? match[0].replace(/[()]/gi, '').replace(/\s/gi, '').split(',') : [];
    return result;
}
export function getFileName(path: string): string {
    // Split the path by '/' or '\' and return the last part
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1];
}

export function getRelativeFilePath(absoluteDirPath: string, absoluteFilePath: string): string {
    const relativePath = path.relative(absoluteDirPath, absoluteFilePath);
    return relativePath;
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
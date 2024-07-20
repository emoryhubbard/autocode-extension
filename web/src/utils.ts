import path from "path";
import fs from "fs";

type RenderTemplateParams = {
  element: HTMLElement;
  template: string;
  callback?: () => void;
  position?: "beforebegin" | "afterbegin" | "beforeend" | "afterend";
  clear?: boolean;
};

type RenderListParams<T> = {
  templateFunction: (item: T) => string;
  element: HTMLElement;
  list: T[];
  position?: "beforebegin" | "afterbegin" | "beforeend" | "afterend";
  clear?: boolean;
};

export function renderTemplate({
  element,
  template,
  callback,
  position = "afterend",
  clear = false,
}: RenderTemplateParams): void {
  if (clear) {
    element.innerHTML = "";
  } // empty element first if so directed
  element.insertAdjacentHTML(position, template);
  if (callback) {
    callback();
  }
}

export async function loadTemplate(path: string): Promise<string> {
  const response = await fetch(path);
  return response.text();
}

export async function loadHeaderFooter(): Promise<void> {
  const header = await loadTemplate(`../templates/header.html`);
  const footer = await loadTemplate(`../templates/footer.html`);

  renderTemplate({ element: select("header"), template: header, clear: true });
  renderTemplate({ element: select("footer"), template: footer, clear: true });
}

export function renderList<T>({
  templateFunction,
  element,
  list,
  position = "afterend",
  clear = false,
}: RenderListParams<T>): void {
  let templates = "";
  for (const item of list) {
    templates += templateFunction(item); // add all templates
  }

  if (clear) {
    element.innerHTML = "";
  } // empty element first if so directed
  element.insertAdjacentHTML(position, templates);
}

export function getParam(param: string): string | null {
  const query = window.location.search;
  const urlParams = new URLSearchParams(query);
  return urlParams.get(param);
}

// wrapper for querySelector...returns matching element
export function select(selector: string, parent: Document | HTMLElement = document): HTMLElement {
  return parent.querySelector(selector)!; // want to throw an error if not found
}

// or a more concise version if you are into that sort of thing:
// export const qs = (selector, parent = document) => parent.querySelector(selector);

// retrieve data from localstorage
export function getLocalStorage<T>(key: string): T | null {
  const item = localStorage.getItem(key);
  return item ? JSON.parse(item) : null;
}

// save data to local storage
export function setLocalStorage<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// set a listener for both touchend and click
export function setClick(callback: () => void, selector: string): void {
  const element = select(selector);
  if (element) {
    element.addEventListener("touchend", (event) => {
      event.preventDefault();
      callback();
    });
    element.addEventListener("click", callback);
  }
}

export function setClicks(callback: () => void, ...selectors: string[]): void {
  for (const selector of selectors) {
    setClick(callback, selector);
  }
}

export function toggleClass(selector: string, className: string): void {
  const element = select(selector);
  if (element) {
    element.classList.toggle(removeDot(className));
  }
}

export function toggleClasses(selector: string, ...classNames: string[]): void {
  const element = select(selector);
  if (element) {
    for (const className of classNames) {
      element.classList.toggle(removeDot(className));
    }
  }
}

export function hasClass(selector: string, className: string): boolean {
  const element = select(selector);
  return element ? element.classList.contains(removeDot(className)) : false;
}

function removeDot(className: string): string {
  return className.startsWith('.') ? className.slice(1) : className;
}

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
      response = await fetch(url, requestOptions);
      if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const resultData = await response.json();
      return resultData;
  } catch (error) {
      console.error('Error fetching data:', error);
      throw error;
  }
}

export async function post(url: string, data: {[key: string]: any;}): Promise<any> {
  return fastFetch(url, data, true);
}
export async function get(url: string, data: {[key: string]: any;} | null = null): Promise<any> {
  return fastFetch(url, data, false);
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

export function last(array: any[]) {
  return array[array.length - 1];
}


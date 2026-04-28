
import { BookProject, User } from "../types";

// --- CONFIGURATION ---
export const BACKEND_URL: string = import.meta.env.VITE_GAS_URL || "https://script.google.com/macros/s/AKfycby0sayCXa6ile1mC3JsLqhF3L_f8fjuXB1vwodmwvHIrbpQzr1yT2gSnplpt9viJ199/exec"; 
// ---------------------

export const CloudService = {
  
  async login(url: string, username: string, password: string): Promise<User> {
    const targetUrl = url || BACKEND_URL;
    if (!targetUrl) throw new Error("Backend URL is missing.");

    const response = await fetch(targetUrl, {
      method: 'POST',
      body: JSON.stringify({ action: 'login', username, password })
    });
    const data = await response.json();
    if (data.status === 'error') throw new Error(data.message);
    
    return {
      username: data.username,
      folderId: data.folderId,
      backendUrl: targetUrl
    };
  },

  async signup(url: string, username: string, password: string): Promise<User> {
    const targetUrl = url || BACKEND_URL;
    if (!targetUrl) throw new Error("Backend URL is missing.");

    const response = await fetch(targetUrl, {
      method: 'POST',
      body: JSON.stringify({ action: 'signup', username, password })
    });
    const data = await response.json();
    if (data.status === 'error') throw new Error(data.message);

    return {
      username: data.username,
      folderId: data.folderId,
      backendUrl: targetUrl
    };
  },

  async syncUp(user: User, project: BookProject): Promise<void> {
    const response = await fetch(user.backendUrl, {
      method: 'POST',
      body: JSON.stringify({ 
        action: 'syncUp', 
        folderId: user.folderId, 
        project: project 
      })
    });
    const data = await response.json();
    if (data.status === 'error') throw new Error(data.message);
  },

  async syncDown(user: User): Promise<BookProject[]> {
    const response = await fetch(user.backendUrl, {
      method: 'POST',
      body: JSON.stringify({ 
        action: 'syncDown', 
        folderId: user.folderId 
      })
    });
    const data = await response.json();
    if (data.status === 'error') throw new Error(data.message);
    
    return data.projects || [];
  },

  async exportToDoc(user: User, title: string, description: string, chapters: any[]): Promise<string> {
    const response = await fetch(user.backendUrl, {
      method: 'POST',
      body: JSON.stringify({
        action: 'exportDoc',
        folderId: user.folderId,
        title,
        description,
        chapters
      })
    });
    const data = await response.json();
    if (data.status === 'error') throw new Error(data.message);
    return data.url;
  }
};
